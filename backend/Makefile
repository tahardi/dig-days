# https://clarkgrubb.com/makefile-style-guide
MAKEFLAGS += --warn-undefined-variables
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := pre-pr
.DELETE_ON_ERROR:
.SUFFIXES:

repo_root := $(abspath $(shell git rev-parse --path-format=absolute --git-common-dir)/..)
tools_dir := $(repo_root)/backend/.tools
digdays_env ?= $(HOME)/.config/digdays/env
serve_port ?= 8080
whisper_version ?= v1.9.4
whisper_jobs ?= 4
whisper_cuda ?= $(if $(or $(shell command -v nvcc),$(wildcard /usr/local/cuda/bin/nvcc)),1,0)
whisper_model_name ?= tiny.en
whisper_live_model_name ?= large-v3-turbo
whisper_src=$(tools_dir)/whisper.cpp
whisper_bin=$(whisper_src)/build/bin/whisper-cli
whisper_model=$(tools_dir)/models/ggml-$(whisper_model_name).bin
whisper_live_model=$(tools_dir)/models/ggml-$(whisper_live_model_name).bin

.PHONY: pre-pr
pre-pr: tidy mock lint fix test-unit test-integration

.PHONY: build
build:
	@go build -o bin/digdays ./cmd/digdays

.PHONY: run
run: build
	@set -a; . $(digdays_env); set +a; ./bin/digdays

.PHONY: install
install: build
	@install -D bin/digdays $(HOME)/.local/bin/digdays
	@install \
		-D \
		-m 644 \
		deploy/digdays.service \
		$(HOME)/.config/systemd/user/digdays.service
	@systemctl --user daemon-reload
	@systemctl --user try-restart digdays.service

.PHONY: start
start:
	@systemctl --user start digdays.service
	@tailscale serve --bg $(serve_port)

.PHONY: stop
stop:
	@tailscale serve --https=443 off
	@systemctl --user stop digdays.service

.PHONY: restart
restart:
	@systemctl --user restart digdays.service

.PHONY: fix
fix:
	@go fix ./...

lint_modfile=modfiles/golangci-lint/go.mod
.PHONY: lint
lint: tidy
	@go tool -modfile=$(lint_modfile) golangci-lint run --config .golangci.yaml

.PHONY: lint-version
lint-version:
	@go tool -modfile=$(lint_modfile) golangci-lint --version

mockery_modfile=modfiles/mockery/go.mod
.PHONY: mock
mock: tidy
	@go tool -modfile=$(mockery_modfile) mockery --config=.mockery.yaml

.PHONY: mock-version
mock-version:
	@go tool -modfile=$(mockery_modfile) mockery version

.PHONY: tidy
tidy:
	@go mod tidy

.PHONY: test-unit
test-unit: tidy
	@go test -v -count=1 -race ./internal/...

.PHONY: test-integration
test-integration: export WHISPER_BIN = $(whisper_bin)
test-integration: export WHISPER_MODEL = $(whisper_model)
test-integration: tidy whisper-build whisper-model
	@go test -v -count=1 -race ./test/integration/...

.PHONY: test-live
test-live: export WHISPER_BIN = $(whisper_bin)
test-live: export WHISPER_MODEL = $(whisper_live_model)
test-live: export ANTHROPIC_API_KEY ?= $(shell . $(digdays_env) && echo "$$ANTHROPIC_API_KEY")
test-live: tidy whisper-build $(whisper_live_model)
	@go test -v -count=1 -race ./test/live/...

.PHONY: whisper-build
whisper-build: $(whisper_bin)

$(whisper_bin):
	@if [ ! -d $(whisper_src) ]; then \
		git clone \
			--depth 1 \
			--branch $(whisper_version) \
			https://github.com/ggml-org/whisper.cpp \
			$(whisper_src); \
	fi
	@cmake \
		-S $(whisper_src) \
		-B $(whisper_src)/build \
		-DGGML_CUDA=$(whisper_cuda)
	@cmake \
		--build $(whisper_src)/build \
		-j $(whisper_jobs) \
		--config Release

.PHONY: whisper-model
whisper-model: $(whisper_model)

$(tools_dir)/models/ggml-%.bin:
	@mkdir -p $(@D)
	@curl \
		-fL \
		-o $@ \
		https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$*.bin
