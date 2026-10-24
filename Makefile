# https://clarkgrubb.com/makefile-style-guide
MAKEFLAGS += --warn-undefined-variables
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := pre-pr
.DELETE_ON_ERROR:
.SUFFIXES:

digdays_env ?= $(HOME)/.config/digdays/env
tailscale_host = $(shell tailscale status --json | jq -r '.Self.DNSName // empty' | sed 's/\.$$//')

.PHONY: pre-pr
pre-pr: backend-pre-pr app-pre-pr

.PHONY: backend-pre-pr
backend-pre-pr:
	@$(MAKE) -C backend pre-pr

.PHONY: app-pre-pr
app-pre-pr:
	@npm --prefix app ci
	@npm --prefix app run check

.PHONY: install-backend
install-backend:
	@$(MAKE) -C backend install

.PHONY: start-backend
start-backend:
	@$(MAKE) -C backend start

.PHONY: stop-backend
stop-backend:
	@$(MAKE) -C backend stop

.PHONY: restart-backend
restart-backend:
	@$(MAKE) -C backend restart

.PHONY: install-app
install-app:
	@npm --prefix app ci

.PHONY: start-app
start-app: export EXPO_PUBLIC_BACKEND_URL ?= $(if $(tailscale_host),https://$(tailscale_host))
start-app: export EXPO_PUBLIC_BACKEND_KEY ?= $(shell . $(digdays_env) && echo "$$DIGDAYS_KEY")
start-app:
	@if [ -z "$$EXPO_PUBLIC_BACKEND_URL" ] || [ -z "$$EXPO_PUBLIC_BACKEND_KEY" ]; then \
		echo "warning: no Tailscale address or DIGDAYS_KEY found, so the app uses the values saved in Settings" >&2; \
	fi
	@npm --prefix app start
