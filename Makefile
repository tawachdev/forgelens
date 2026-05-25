.PHONY: check scan baseline drift release-check

check:
	./scripts/check.sh

scan:
	./scripts/scan.sh

baseline:
	./scripts/baseline.sh

drift:
	./scripts/drift.sh

release-check:
	./scripts/release-check.sh
