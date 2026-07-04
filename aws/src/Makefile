# SAM CustomMakeBuilder runs with CodeUri (this directory) mounted as /tmp/samcli/source.
.PHONY: build-IngestWorkerFunction build-PreviewLinkFunction

build-IngestWorkerFunction build-PreviewLinkFunction:
	cp -r $(CURDIR)/* $(ARTIFACTS_DIR)/
	python3 -m pip install -r $(CURDIR)/requirements-worker.txt -t $(ARTIFACTS_DIR)/ --no-cache-dir
