.PHONY: check scan baseline drift site release-check

check:
	./scripts/check.sh

scan:
	./scripts/scan.sh

baseline:
	./scripts/baseline.sh

drift:
	./scripts/drift.sh

site:
	./scripts/site-build.sh

release-check:
	./scripts/release-check.sh
