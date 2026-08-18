"""Ensemble used by the web app: chebifier's WMV-F1 ensemble plus per-model weights.

Chebifier weights a vote by `confidence * trust`, where trust is the model's class-wise F1 on the
validation set. The `model_weight` that used to scale a model's votes independently of the class is
still read from the configuration by `BasePredictor`, but the ensemble no longer applies it. The
web app needs it back, both to give the symbolic classifiers the say they had before and because
the "Ensemble settings" panel lets a user retune the weights per request.
"""

import copy
from pathlib import Path

import torch
from chebifier.ensemble.weighted_majority_ensemble import WMVwithF1Ensemble
from chebifier.inconsistency_resolution import NEUTRAL

DEFAULT_MODEL_WEIGHT = 1


class WeightedWMVF1Ensemble(WMVwithF1Ensemble):
    """WMV-F1 whose votes are additionally scaled by a per-model weight.

    Models the ensemble was not calibrated on (the ChEBI lookup has no validation predictions)
    vote with a neutral threshold and full trust, so their influence is set by their weight alone.

    `calibration_names` maps the names the app shows to the names the calibration files in
    `ensemble_dir` were written under, so models can be renamed in the configuration without
    touching the calibration.
    """

    def __init__(
        self,
        ensemble_dir: str,
        calibration_names: dict[str, str] | None = None,
        model_weights: dict[str, float] | None = None,
        **kwargs,
    ):
        super().__init__(ensemble_dir, **kwargs)
        self.calibration_names = dict(calibration_names or {})
        self.model_weights = dict(model_weights or {})
        self._f1_cache: dict[str, torch.Tensor | None] = {}

    def with_weights(self, model_weights: dict[str, float] | None):
        """A view of this ensemble that votes with the given weights.

        The clone shares the loaded calibration, so this is cheap enough to do per request - and
        unlike mutating the shared instance it stays correct when requests overlap.
        """
        if not model_weights:
            return self
        clone = copy.copy(self)
        clone.model_weights = {**self.model_weights, **model_weights}
        return clone

    def calibration_name(self, model_name: str) -> str:
        return self.calibration_names.get(model_name, model_name)

    def model_weight(self, model_name: str) -> float:
        return float(self.model_weights.get(model_name, DEFAULT_MODEL_WEIGHT))

    def _load_prediction_thresholds(self) -> dict[str, float]:
        """Thresholds keyed by the names the app uses, with a neutral default for models that
        were not part of the calibration."""
        calibrated = super()._load_prediction_thresholds()
        thresholds = {
            model_name: calibrated.get(self.calibration_name(model_name), NEUTRAL)
            for model_name in self.calibration_names
        }
        # models that are neither renamed nor uncalibrated keep their own entry
        return {**calibrated, **thresholds}

    def _classwise_f1(self, model_name: str, num_classes: int) -> torch.Tensor:
        if model_name not in self._f1_cache:
            path = (
                Path(self.ensemble_dir)
                / f"{self.calibration_name(model_name)}_classwise_f1.txt"
            )
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    f1 = torch.tensor([float(x) for x in f.read().splitlines()])
                if f1.shape[0] != num_classes:
                    raise ValueError(
                        f"Class-wise F1 scores for {model_name} cover {f1.shape[0]} classes, but "
                        f"the ensemble runs on {num_classes}. The class list has to be the one the "
                        f"ensemble was calibrated on."
                    )
            else:
                print(
                    f"No class-wise F1 scores for {model_name} in {self.ensemble_dir}, "
                    f"voting with full trust."
                )
                f1 = None
            self._f1_cache[model_name] = f1
        f1 = self._f1_cache[model_name]
        return torch.ones(num_classes) if f1 is None else f1

    def calculate_trust(self, predictions: dict[str, torch.Tensor]) -> torch.Tensor:
        weighting_strength, weighting_exponent = self._load_hyperparameters()
        num_molecules, num_classes = next(iter(predictions.values())).shape
        trust = torch.ones(
            (num_molecules, num_classes, len(predictions)), dtype=torch.float32
        )
        for model_idx, model_name in enumerate(predictions):
            classwise_f1 = self._classwise_f1(model_name, num_classes)
            trust[:, :, model_idx] = (
                weighting_strength * classwise_f1 + (1 - weighting_strength)
            ) ** weighting_exponent * self.model_weight(model_name)
        return trust
