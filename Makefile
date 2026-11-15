# Offline Entertainment: shortcuts for daily use and development.  Run `make` to list them.
PY ?= python3
VENV := .venv
BIN := $(VENV)/bin
PORT ?= 8765

.DEFAULT_GOAL := help
.PHONY: help setup run run-lan test lint smoke check docker-up docker-down key update clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

$(BIN)/python:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -q --upgrade pip
	$(BIN)/pip install -q -r requirements.txt

setup: $(BIN)/python ## Create the virtualenv and install everything (incl. dev tools)
	$(BIN)/pip install -q -r requirements-dev.txt
	@echo "Ready. Next: make run"

run: $(BIN)/python ## Start on 127.0.0.1 (this computer only)
	$(BIN)/python server.py --port $(PORT)

run-lan: $(BIN)/python ## Start on 0.0.0.0 (reachable from your home network)
	$(BIN)/python server.py --host 0.0.0.0 --port $(PORT)

test: $(BIN)/python ## Run the unit tests
	$(BIN)/python -m unittest discover -s tests -v

lint: ## Lint with ruff (errors, likely bugs and security rules)
	$(BIN)/ruff check .

smoke: $(BIN)/python ## Start the real server: key 600, 401 without key, 200 with key
	./scripts/smoke.sh $(BIN)/python

check: lint test smoke ## Everything CI runs

docker-up: ## Build and start with Docker on 127.0.0.1:8765
	docker compose up -d --build
	@sleep 3; echo "Your key: $$(docker compose exec -T offline-entertainment cat /config/key 2>/dev/null)"

docker-down: ## Stop the container
	docker compose down

key: ## Print your key and the one-tap link
	@k="$${OFFLINE_KEY:-$$(cat "$${OFFLINE_CONFIG_DIR:-$${XDG_CONFIG_HOME:-$$HOME/.config}/offline-entertainment}/key" 2>/dev/null \
	   || docker compose exec -T offline-entertainment cat /config/key 2>/dev/null)}"; \
	 echo "Key:  $$k"; echo "Link: http://127.0.0.1:$(PORT)/#k=$$k"

update: $(BIN)/python ## Update yt-dlp (do this first when a site stops working)
	$(BIN)/pip install -U "yt-dlp[default]"

clean: ## Remove the virtualenv and caches (your key is kept)
	rm -rf $(VENV) __pycache__ tests/__pycache__ .ruff_cache
