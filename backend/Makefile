.PHONY: build-ApiFunction

build-ApiFunction:
	cp -r $(CURDIR)/app $(ARTIFACTS_DIR)/
	cp $(CURDIR)/lambda_handler.py $(ARTIFACTS_DIR)/
	python3 -m pip install -r $(CURDIR)/requirements-lambda.txt -t $(ARTIFACTS_DIR)/ --no-cache-dir
