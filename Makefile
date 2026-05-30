.PHONY: help check scan baseline drift release-check doctor ui quick hard health clean save diff context

help:
	@echo "make ui            Generate UI/UX report"
	@echo "make health        Run safety/readiness check"
	@echo "make clean         Remove generated output folder"
	@echo "make save          Save current snapshot as baseline"
	@echo "make diff          Compare latest scan with baseline"
	@echo "make context       Print Codex context prompt"
	@echo "make quick         Fast flow: health + ui"
	@echo "make hard          Full flow: scan + save + diff"
	@echo "make scan          Generate all reports"
	@echo "make baseline      Legacy alias for save"
	@echo "make drift         Legacy alias for diff"
	@echo "make check         Lint + format + typecheck + test + build"
	@echo "make release-check Release readiness checks"

check:
	./scripts/check.sh

health:
	pnpm dev doctor --root . --out .forgelens

ui:
	pnpm dev ui-ux --root . --out .forgelens

quick: health ui

hard: scan save diff

scan:
	./scripts/scan.sh

save:
	./scripts/baseline.sh

diff:
	./scripts/drift.sh

context:
	pnpm dev prompt --out .forgelens

doctor: health

clean:
	pnpm dev clear --yes

baseline: save

drift: diff

release-check:
	./scripts/release-check.sh
