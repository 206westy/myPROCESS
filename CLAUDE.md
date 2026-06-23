# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a **greenfield project**. No application code exists yet — the directory currently holds only the raw equipment process data described below. The plan is to build a **Next.js** app providing **FDC (Fault Detection & Classification)** and **SPC (Statistical Process Control)** on top of this data.

The distinguishing goal: a **new kind of adaptive SPC** that uses domain understanding of the equipment to control specs *contextually* (per recipe / stage / step / equipment-state) rather than applying static, globally-fixed control limits. When implementing SPC logic, the limits/specs are expected to be a function of process context, not constants.

When scaffolding the app, confirm preferences (App Router vs Pages, package manager, charting/data layer) before committing to a structure — none of that is decided yet.

## The data

Equipment domain: **semiconductor dry-strip (ashing / photoresist removal) tools**. "EHM Target Data" = Equipment Health Monitoring trace data. Four tool models are represented, one archive each:

- `PRECIA_EHM Target Data.zip.sLDH`
- `PROLITE_EHM Target Data.zip.sLDH`
- `Supra Vplus_EHM Target Data.zip.sLDH`
- `SupraXP_EHM Target Data.zip.sLDH`

The `.sLDH` files are **not plain zips** — they are wrapped/encrypted by a DLP/security layer (the header is not the `PK` zip magic) and cannot be unpacked directly with standard tools. Do not assume they are readable; the user must export decrypted copies.

The only directly usable data today is `supraxp_ehm target data/` — 32 CSV parts (`RawData_1_320_69.zip_00_part_NNNNN.csv`), the decompressed SupraXP archive. Treat these parts as a **single logical trace table** split by row count, not as independent datasets.

### CSV schema (FDC trace format)

- 127 columns, one row per ~0.3 s sample (high-frequency time-series trace).
- First 7 columns are the **context/key**: `Processed Time` (ISO 8601 UTC), `Lot`, `Recipe`, `Stage`, `Wafer No.`, `System Label`, `Recipe_Step_Num`. These define the slicing dimensions for both FDC and the context-aware SPC.
- The remaining ~120 columns are **sensor signals** grouped by subsystem — e.g. `APC_*` (pressure/throttle valve control), `Gas1..Gas5_*` (MFC flow/pressure/valve), `Mat_*` (RF matcher: VC positions, VDC/VPP/Vrms), `SourcePwr_*` (RF source power read/reflect/set), `Pin_*` (lift-pin servo), `Wall_*`/`Temp*`/`Heater_*` (thermal), `Water_Flow_*` (cooling), plus interlocks/status flags.
- Many flag-style columns are booleans encoded as `"0.0"`/`"1.0"` strings; analog signals are quoted floats. All values are quoted strings — parse/cast accordingly.
- A single CSV part typically covers one `Recipe`/`Stage` context; the full lot spans multiple parts. Group by `Lot` + `Wafer No.` + `Recipe_Step_Num` to reconstruct a per-wafer step trace.

## Working notes

- Paths contain spaces (`ehm_target data`, `supraxp_ehm target data`) — always quote them in shell commands. Primary shell is PowerShell; the Bash tool is available for POSIX scripts.
- This is not a git repository yet.
