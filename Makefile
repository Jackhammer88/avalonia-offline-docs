DOCS_DIR := avalonia-docs
APP_DIR := offline-app
DOCS_BUILD_DIR := $(DOCS_DIR)/build
APP_BUILD_DIR := $(APP_DIR)/build


BUILD_DATE := $(shell date +%Y.%m.%d)
APP_VERSION := $(shell date +%Y.%-m.%-d)
DOCS_COMMIT := $(shell cd $(DOCS_DIR) && git rev-parse --short HEAD)

.PHONY: build-docs update-docs sync build-info run linux win all clean

build-docs:
	cd $(DOCS_DIR) && npm install && npm run build

update-docs:
	git submodule update --remote --merge --recursive

sync: build-docs
	rm -rf $(APP_BUILD_DIR)
	cp -r $(DOCS_BUILD_DIR) $(APP_BUILD_DIR)

build-info:
	@echo '{ "date": "$(BUILD_DATE)", "commit": "$(DOCS_COMMIT)", "version": "$(APP_VERSION)" }' > $(APP_DIR)/build-info.json
	cd $(APP_DIR) && npm pkg set version="$(APP_VERSION)"

run: sync build-info
	cd $(APP_DIR) && npm run electron

linux: sync build-info
	cd $(APP_DIR) && npm run dist -- --linux

win: sync build-info
	cd $(APP_DIR) && npm run dist -- --win

all: sync build-info
	cd $(APP_DIR) && npm run dist -- --linux --win

clean:
	rm -rf $(APP_BUILD_DIR)
	rm -rf $(APP_DIR)/dist
	rm -f $(APP_DIR)/build-info.json

