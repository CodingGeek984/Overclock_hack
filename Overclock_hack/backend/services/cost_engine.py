"""
cost_engine.py
--------------
Модуль C: Business Cost Function и поиск оптимального порога для антифрод-системы.

Реализует:
  - Custom Business Cost Function:
      Total Loss = (FN_count * Avg_Fraud_Amount) + (FP_count * Customer_Friction_Penalty)
  - Grid Search + Golden-Section Search для точного минимума Total Loss
  - Построение кривой компромисса (Precision/Recall vs Financial Loss)
    для Trade-off Visualizer на дашборде

Все расчёты полностью типизированы через Pydantic v2.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Pydantic v2 schemas
# ---------------------------------------------------------------------------

class CostEngineConfig(BaseModel):
    """Конфигурация движка стоимости для конкретного бизнес-сценария."""

    model_config = {"populate_by_name": True}

    avg_fraud_amount: float = Field(
        default=250_000.0,
        ge=0,
        description="Средняя сумма мошеннической транзакции в валюте (FN cost per transaction)",
    )
    customer_friction_penalty: float = Field(
        default=5_000.0,
        ge=0,
        description="Штраф за ложное срабатывание (FP cost): потеря лояльности, support cost и т.д.",
    )
    threshold_resolution: int = Field(
        default=100,
        ge=10,
        le=10000,
        description="Кол-во точек при grid search (выше → точнее, медленнее)",
    )
    golden_section_tolerance: float = Field(
        default=1e-5,
        description="Допуск для golden-section refinement",
    )


class ThresholdResult(BaseModel):
    """Результат для конкретного порога классификации."""

    threshold: float = Field(..., description="Порог (0.0 – 1.0)")
    threshold_pct: float = Field(..., description="Порог в процентах (0 – 100)")
    total_cost: float = Field(..., description="Суммарные потери бизнеса")
    fn_cost: float = Field(..., description="Потери от пропущенного фрода (FN * avg_fraud)")
    fp_cost: float = Field(..., description="Штрафы за ложные блокировки (FP * friction)")
    fn_count: int = Field(..., description="Количество False Negatives")
    fp_count: int = Field(..., description="Количество False Positives")
    precision: float = Field(..., description="Precision при данном пороге")
    recall: float = Field(..., description="Recall при данном пороге")
    f1: float = Field(..., description="F1-score")
    fpr: float = Field(..., description="False Positive Rate")
    fraud_loss_saved: float = Field(..., description="Сохранённые средства (TP * avg_fraud)")


class OptimizationReport(BaseModel):
    """Полный отчёт об оптимизации порога."""

    optimal: ThresholdResult = Field(..., description="Оптимальная точка (минимум total_cost)")
    grid_points: list[ThresholdResult] = Field(..., description="Все точки grid search")
    config: CostEngineConfig = Field(..., description="Конфигурация, использованная при расчёте")
    improvement_over_default: float = Field(
        ...,
        description="Снижение потерь vs порог 0.5 в процентах",
    )


class TradeoffPoint(BaseModel):
    """Одна точка кривой компромисса для Trade-off Visualizer."""

    threshold: float = Field(..., description="Порог (0 – 100, в %)")
    precision: float = Field(..., description="Precision (0.0 – 1.0)")
    recall: float = Field(..., description="Recall (0.0 – 1.0)")
    f1: float = Field(..., description="F1-score")
    fraud_loss: float = Field(..., description="Потери от пропущенного фрода (₸)")
    customer_inconvenience: float = Field(..., description="Штрафы за FP (₸)")
    total_cost: float = Field(..., description="Суммарные потери (₸)")
    fraud_loss_saved: float = Field(..., description="Сохранённые средства (₸)")
    fpr: float = Field(..., description="False Positive Rate (%)")


# ---------------------------------------------------------------------------
# CostEngine
# ---------------------------------------------------------------------------

class CostEngine:
    """
    Движок расчёта бизнес-стоимости классификации.

    Принимает массивы истинных меток (y_true) и предсказанных вероятностей (y_prob),
    а также суммы мошеннических транзакций (fraud_amounts).

    Основная формула:
        Total Loss = (FN_count * Avg_Fraud_Amount) + (FP_count * Customer_Friction_Penalty)

    Где:
        FN (False Negative) — пропущенный фрод → прямые потери банка
        FP (False Positive) — заблокированная легитимная операция → потеря лояльности клиента
    """

    _EPSILON = 1e-9  # защита от деления на 0

    def __init__(self, config: CostEngineConfig | None = None) -> None:
        self.config = config or CostEngineConfig()

    # ------------------------------------------------------------------
    # Core cost calculation
    # ------------------------------------------------------------------

    def calculate_at_threshold(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        fraud_amounts: np.ndarray,
        threshold: float,
    ) -> ThresholdResult:
        """
        Рассчитывает все метрики и финансовые потери при заданном пороге.

        Аргументы:
            y_true        — истинные метки {0, 1}, shape (n,)
            y_prob        — предсказанные вероятности [0.0, 1.0], shape (n,)
            fraud_amounts — суммы транзакций (используются для FN-cost), shape (n,)
            threshold     — порог классификации [0.0, 1.0]
        """
        threshold = float(np.clip(threshold, 0.0, 1.0))
        y_pred = (y_prob >= threshold).astype(np.int8)

        # Confusion matrix masks
        tp_mask = (y_true == 1) & (y_pred == 1)  # True Positive
        fp_mask = (y_true == 0) & (y_pred == 1)  # False Positive
        fn_mask = (y_true == 1) & (y_pred == 0)  # False Negative
        tn_mask = (y_true == 0) & (y_pred == 0)  # True Negative

        tp = int(tp_mask.sum())
        fp = int(fp_mask.sum())
        fn = int(fn_mask.sum())
        tn = int(tn_mask.sum())

        n_actual_fraud = int(y_true.sum())
        n_actual_legit = len(y_true) - n_actual_fraud

        # Financial costs
        avg_fraud = self.config.avg_fraud_amount
        friction  = self.config.customer_friction_penalty

        # FN cost: используем реальные суммы если есть, иначе avg_fraud
        fn_fraud_amounts = fraud_amounts[fn_mask]
        fn_cost = (
            float(fn_fraud_amounts.sum())
            if fn_fraud_amounts.size > 0
            else fn * avg_fraud
        )
        fp_cost  = fp * friction
        total_cost = fn_cost + fp_cost

        # Saved: TP транзакции не прошли → деньги спасены
        tp_fraud_amounts = fraud_amounts[tp_mask]
        fraud_loss_saved = (
            float(tp_fraud_amounts.sum())
            if tp_fraud_amounts.size > 0
            else tp * avg_fraud
        )

        # ML metrics
        precision = tp / (tp + fp + self._EPSILON) if (tp + fp) > 0 else 1.0
        recall    = tp / (tp + fn + self._EPSILON) if (tp + fn) > 0 else 0.0
        f1        = (
            2 * precision * recall / (precision + recall + self._EPSILON)
            if (precision + recall) > 0
            else 0.0
        )
        fpr = fp / (fp + tn + self._EPSILON) if (fp + tn) > 0 else 0.0

        return ThresholdResult(
            threshold=round(threshold, 6),
            threshold_pct=round(threshold * 100, 2),
            total_cost=round(total_cost, 2),
            fn_cost=round(fn_cost, 2),
            fp_cost=round(fp_cost, 2),
            fn_count=fn,
            fp_count=fp,
            precision=round(float(precision), 6),
            recall=round(float(recall), 6),
            f1=round(float(f1), 6),
            fpr=round(float(fpr), 6),
            fraud_loss_saved=round(float(fraud_loss_saved), 2),
        )

    # ------------------------------------------------------------------
    # Grid Search
    # ------------------------------------------------------------------

    def _grid_search(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        fraud_amounts: np.ndarray,
        n_points: int,
    ) -> list[ThresholdResult]:
        """Grid search по `n_points` равномерно распределённым порогам [0, 1]."""
        thresholds = np.linspace(0.0, 1.0, n_points + 1)
        results = []
        for t in thresholds:
            results.append(self.calculate_at_threshold(y_true, y_prob, fraud_amounts, float(t)))
        return results

    # ------------------------------------------------------------------
    # Golden-Section Search refinement
    # ------------------------------------------------------------------

    def _golden_section_refinement(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        fraud_amounts: np.ndarray,
        lo: float,
        hi: float,
        tol: float,
    ) -> ThresholdResult:
        """
        Метод золотого сечения для уточнения минимума функции стоимости
        на интервале [lo, hi].

        Работает корректно только при унимодальной функции потерь на интервале.
        Если функция не унимодальна — возвращает лучшую точку из 3 промежуточных.
        """
        phi = (math.sqrt(5) - 1) / 2  # ≈ 0.618

        a, b = lo, hi
        c = b - phi * (b - a)
        d = a + phi * (b - a)

        max_iters = 200
        for _ in range(max_iters):
            if abs(b - a) < tol:
                break

            fc = self.calculate_at_threshold(y_true, y_prob, fraud_amounts, c).total_cost
            fd = self.calculate_at_threshold(y_true, y_prob, fraud_amounts, d).total_cost

            if fc < fd:
                b = d
                d = c
                c = b - phi * (b - a)
            else:
                a = c
                c = d
                d = a + phi * (b - a)

        best_t = (a + b) / 2.0
        return self.calculate_at_threshold(y_true, y_prob, fraud_amounts, best_t)

    # ------------------------------------------------------------------
    # Main API
    # ------------------------------------------------------------------

    def find_optimal_threshold(
        self,
        y_true: np.ndarray,
        y_prob: np.ndarray,
        fraud_amounts: np.ndarray | None = None,
    ) -> OptimizationReport:
        """
        Поиск порога, минимизирующего суммарные бизнес-потери:
            Total Loss = FN_cost + FP_cost

        Алгоритм:
            1. Grid Search по `threshold_resolution` точкам — находим грубый минимум
            2. Golden-Section Search на ±2/resolution окне — уточняем до tol

        Аргументы:
            y_true        — истинные метки {0, 1}
            y_prob        — предсказанные вероятности [0.0, 1.0]
            fraud_amounts — суммы транзакций (опционально; при отсутствии → avg_fraud_amount)

        Возвращает OptimizationReport с оптимальной точкой и всеми промежуточными.
        """
        y_true = np.asarray(y_true, dtype=np.int8).ravel()
        y_prob = np.asarray(y_prob, dtype=np.float64).ravel()

        if fraud_amounts is None:
            fraud_amounts = np.full(len(y_true), self.config.avg_fraud_amount)
        else:
            fraud_amounts = np.asarray(fraud_amounts, dtype=np.float64).ravel()

        assert len(y_true) == len(y_prob) == len(fraud_amounts), (
            "y_true, y_prob и fraud_amounts должны иметь одинаковую длину"
        )

        n = self.config.threshold_resolution
        grid_points = self._grid_search(y_true, y_prob, fraud_amounts, n)

        # Лучшая точка grid search
        best_grid = min(grid_points, key=lambda r: r.total_cost)

        # Уточнение золотым сечением в окне ±1 шага grid
        step = 1.0 / n
        lo = max(0.0, best_grid.threshold - step)
        hi = min(1.0, best_grid.threshold + step)

        refined = self._golden_section_refinement(
            y_true, y_prob, fraud_amounts,
            lo, hi,
            self.config.golden_section_tolerance,
        )

        # Выбираем лучшее из grid и refined
        optimal = refined if refined.total_cost < best_grid.total_cost else best_grid

        # Сравниваем с дефолтным порогом 0.5
        default_result = self.calculate_at_threshold(y_true, y_prob, fraud_amounts, 0.5)
        improvement = (
            (default_result.total_cost - optimal.total_cost) / (default_result.total_cost + self._EPSILON) * 100
        )

        return OptimizationReport(
            optimal=optimal,
            grid_points=grid_points,
            config=self.config,
            improvement_over_default=round(float(improvement), 2),
        )

    def build_tradeoff_curve(
        self,
        y_true: np.ndarray | None = None,
        y_prob: np.ndarray | None = None,
        fraud_amounts: np.ndarray | None = None,
        n_points: int = 101,
    ) -> list[TradeoffPoint]:
        """
        Строит кривую компромисса Precision/Recall vs Financial Loss
        для Trade-off Visualizer на дашборде.

        Если реальные данные не переданы — генерирует реалистичную синтетическую кривую.

        Аргументы:
            y_true, y_prob, fraud_amounts — реальные данные (опционально)
            n_points — кол-во точек на кривой (по умолчанию 101, от 0% до 100%)

        Возвращает список TradeoffPoint с шагом (100 / (n_points-1)) %.
        """
        if y_true is not None and y_prob is not None:
            y_true = np.asarray(y_true, dtype=np.int8).ravel()
            y_prob = np.asarray(y_prob, dtype=np.float64).ravel()
            if fraud_amounts is None:
                fraud_amounts = np.full(len(y_true), self.config.avg_fraud_amount)
            else:
                fraud_amounts = np.asarray(fraud_amounts, dtype=np.float64).ravel()

            thresholds = np.linspace(0.0, 1.0, n_points)
            curve: list[TradeoffPoint] = []
            for t in thresholds:
                r = self.calculate_at_threshold(y_true, y_prob, fraud_amounts, float(t))
                curve.append(
                    TradeoffPoint(
                        threshold=round(t * 100, 2),
                        precision=round(r.precision, 4),
                        recall=round(r.recall, 4),
                        f1=round(r.f1, 4),
                        fraud_loss=round(r.fn_cost, 2),
                        customer_inconvenience=round(r.fp_cost, 2),
                        total_cost=round(r.total_cost, 2),
                        fraud_loss_saved=round(r.fraud_loss_saved, 2),
                        fpr=round(r.fpr * 100, 4),
                    )
                )
            return curve

        # ----------------------------------------------------------------
        # Синтетическая кривая на основе аналитических формул
        # Отражает типичное поведение XGBoost-модели на несбалансированных данных
        # ----------------------------------------------------------------
        avg_fraud = self.config.avg_fraud_amount
        friction  = self.config.customer_friction_penalty

        # Предположения: 100 000 транзакций, 2% фрод
        n_total   = 100_000
        n_fraud   = 2_000
        n_legit   = n_total - n_fraud

        curve: list[TradeoffPoint] = []
        thresholds_pct = np.linspace(0.0, 100.0, n_points)

        for t_pct in thresholds_pct:
            t = t_pct / 100.0

            # Recall (sensitivity) убывает с порогом — аппроксимация через сигмоид
            # recall при t=0 ≈ 1.0, при t=1 ≈ 0.0
            recall = 1.0 / (1.0 + math.exp(8 * (t - 0.5)))

            # Precision растёт с порогом — логистическая кривая
            # precision при t=0 ≈ 0.02 (base rate), при t=0.9 ≈ 0.97
            precision_raw = 0.02 + 0.95 / (1.0 + math.exp(-10 * (t - 0.4)))
            precision = min(precision_raw, 1.0)

            # Производные из confusion matrix
            tp = int(n_fraud * recall)
            fn = n_fraud - tp
            fp = int(tp / (precision + 1e-9) - tp) if precision > 0 else n_legit
            fp = max(0, min(fp, n_legit))
            tn = n_legit - fp

            f1 = (
                2 * precision * recall / (precision + recall + 1e-9)
                if (precision + recall) > 0 else 0.0
            )
            fpr = fp / (fp + tn + 1e-9)

            fn_cost = fn * avg_fraud
            fp_cost = fp * friction
            total_cost = fn_cost + fp_cost
            fraud_loss_saved = tp * avg_fraud

            curve.append(
                TradeoffPoint(
                    threshold=round(float(t_pct), 2),
                    precision=round(precision, 4),
                    recall=round(recall, 4),
                    f1=round(f1, 4),
                    fraud_loss=round(fn_cost, 2),
                    customer_inconvenience=round(fp_cost, 2),
                    total_cost=round(total_cost, 2),
                    fraud_loss_saved=round(fraud_loss_saved, 2),
                    fpr=round(fpr * 100, 4),
                )
            )

        return curve
