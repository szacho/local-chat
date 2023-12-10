import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from huggingface_hub import hf_hub_download

MODELS_CONFIG = Path(".env.local")


def read_models_info(path: Path = MODELS_CONFIG) -> Dict[str, Any]:
    with path.open() as config_file:
        models_info = config_file.read().split("`")[1]
        models_info = json.loads(models_info)
        return {model["shortName"]: model for model in models_info}


def download_model(model_info: Dict[str, Any], local_dir: str = "/models") -> None:
    output_path = Path(local_dir) / model_info["weightsFilename"]
    if not output_path.exists():
        output_path.parent.mkdir(parents=True, exist_ok=True)
        hf_hub_download(
            repo_id=model_info["name"],
            filename=model_info["weightsFilename"],
            local_dir=local_dir,
            local_dir_use_symlinks=False,
        )


def start_chat(model_info: Dict[str, Any], args: List[str]):
    download_model(model_info)

    weights_filename = model_info["weightsFilename"]
    n_gpu_layers = model_info["nGpuLayers"]
    context_length = model_info["contextLength"]

    cmd = f"./server -m /models/{weights_filename} -c {context_length} -ngl {n_gpu_layers} {' '.join(args)}"
    os.system(cmd)


if __name__ == "__main__":
    args = sys.argv[1:]

    model_name = args[0]
    models_info = read_models_info()

    if model_name not in models_info:
        raise ValueError(
            f"model {args.model} not found, choose from {list(models_info.keys())}"
        )

    start_chat(models_info[model_name], args[1:])
