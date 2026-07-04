# Custom build for the ingest worker — bundles yt-dlp, ffmpeg helpers, and ingest_lib.
.PHONY: build-IngestWorkerFunction

build-IngestWorkerFunction:
	cp -r $(CURDIR)/src/* $(ARTIFACTS_DIR)/
	python3 -m pip install -r $(CURDIR)/src/requirements-worker.txt -t $(ARTIFACTS_DIR)/ --no-cache-dir
