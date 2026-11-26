"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ AI - Report Upload & Parsing Blueprint
Handles PDF, Excel, and CSV noon-report uploads with automatic field extraction.
"""
import os
import re
import io
import json
from datetime import datetime, date
from flask import Blueprint, g, request, jsonify, current_app
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import ReportUpload, NoonReport, Vessel, Voyage
from app.tenancy import audit, current_org_id, get_scoped, scoped_query, tenant_required

uploads_bp = Blueprint('uploads', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'xlsx', 'xls', 'csv'}

# ---------------------------------------------------------------------------
# Column name → NoonReport field mapping
# ---------------------------------------------------------------------------
COLUMN_MAP = {
    # Date/Time
    "date":              "report_date",
    "report_date":       "report_date",
    "time":              "report_time",
    "report_time":       "report_time",
    # Position
    "lat":               "latitude",
    "latitude":          "latitude",
    "lon":               "longitude",
    "lng":               "longitude",
    "longitude":         "longitude",
    # Navigation
    "sog":               "speed_over_ground",
    "speed":             "speed_over_ground",
    "speed_over_ground": "speed_over_ground",
    "stw":               "speed_through_water",
    "speed_through_water": "speed_through_water",
    "dist":              "distance_noon_to_noon",
    "distance":          "distance_noon_to_noon",
    "distance_noon_to_noon": "distance_noon_to_noon",
    "dtg":               "distance_to_go",
    "distance_to_go":    "distance_to_go",
    "rpm":               "rpm",
    "course":            "course",
    "slip":              "slip_percentage",
    "me_power":          "me_power",
    # Weather
    "wind":              "wind_force_bft",
    "wind_force":        "wind_force_bft",
    "bft":               "wind_force_bft",
    "beaufort":          "wind_force_bft",
    "wind_dir":          "wind_direction",
    "wind_direction":    "wind_direction",
    "wind_speed":        "wind_speed_knots",
    "wave":              "wave_height",
    "wave_height":       "wave_height",
    "swell":             "swell_height",
    "swell_height":      "swell_height",
    "sea_state":         "sea_state",
    "visibility":        "visibility",
    # Fuel (consumption)
    "lsfo":              "me_lsfo",
    "me_lsfo":           "me_lsfo",
    "mgo":               "me_mgo",
    "me_mgo":            "me_mgo",
    "ae_lsfo":           "ae_lsfo",
    "ae_mgo":            "ae_mgo",
    "boiler_lsfo":       "boiler_lsfo",
    "boiler_mgo":        "boiler_mgo",
    "total_lsfo":        "total_lsfo_consumption",
    "total_mgo":         "total_mgo_consumption",
    "total_fuel":        "total_fuel_consumption",
    "fuel":              "total_fuel_consumption",
    # ROB
    "rob_lsfo":          "rob_lsfo",
    "rob_mgo":           "rob_mgo",
    "rob_fo":            "rob_lsfo",
    "rob":               "rob_lsfo",
    "rob_do":            "rob_mgo",
    "rob_lube":          "rob_lube_oil",
    "lube_oil_rob":      "rob_lube_oil",
    # Cargo / Draft
    "cargo":             "cargo_quantity",
    "cargo_qty":         "cargo_quantity",
    "draft_fwd":         "draft_fore",
    "draft_fore":        "draft_fore",
    "draft_aft":         "draft_aft",
    # Engine
    "scav_press":        "scavenge_pressure",
    "scavenge":          "scavenge_pressure",
    "exhaust_temp":      "exhaust_temp_avg",
    "tc_rpm":            "turbo_rpm",
    "turbo_rpm":         "turbo_rpm",
}

# PDF regex patterns  (pattern → NoonReport field)
PDF_PATTERNS = [
    (r"(?:LAT|Latitude)[:\s]+([+-]?\d{1,3}\.?\d*)\s*([NS])?", "latitude"),
    (r"(?:LON|LONG|Longitude)[:\s]+([+-]?\d{1,3}\.?\d*)\s*([EW])?", "longitude"),
    (r"(?:SOG|Speed Over Ground|Speed)[:\s]+(\d{1,3}\.?\d*)\s*(?:kts?|knots?)", "speed_over_ground"),
    (r"(?:STW|Speed Through Water)[:\s]+(\d{1,3}\.?\d*)\s*(?:kts?|knots?)", "speed_through_water"),
    (r"(?:Distance|DIST|Dist N-N)[:\s]+(\d{1,4}\.?\d*)\s*(?:nm|NM)", "distance_noon_to_noon"),
    (r"RPM[:\s]+(\d{2,4}\.?\d*)", "rpm"),
    (r"(?:Wind Force|Wind|BFT|Beaufort)[:\s]+(\d{1,2})", "wind_force_bft"),
    (r"(?:Wave Height|Wave|WAVE)[:\s]+(\d{1,2}\.?\d*)\s*m?", "wave_height"),
    (r"(?:Swell Height|Swell|SWELL)[:\s]+(\d{1,2}\.?\d*)\s*m?", "swell_height"),
    (r"(?:LSFO Cons|LSFO|ME LSFO|HFO)[:\s]+(\d{1,3}\.?\d*)\s*(?:MT|mt)", "me_lsfo"),
    (r"(?:MGO Cons|MGO|DO Cons)[:\s]+(\d{1,2}\.?\d*)\s*(?:MT|mt)", "me_mgo"),
    (r"(?:Total Fuel|Total Cons|Total F\.O)[:\s]+(\d{1,3}\.?\d*)\s*(?:MT|mt)", "total_fuel_consumption"),
    (r"(?:ROB LSFO|ROB HFO|FO ROB)[:\s]+(\d{1,4}\.?\d*)\s*(?:MT|mt)", "rob_lsfo"),
    (r"(?:ROB MGO|ROB DO|DO ROB)[:\s]+(\d{1,3}\.?\d*)\s*(?:MT|mt)", "rob_mgo"),
    (r"(?:Date|REPORT DATE)[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}[/\-\.]\d{2}[/\-\.]\d{4})", "report_date"),
    (r"(?:ME Power|POWER|BHP|KW)[:\s]+(\d{1,6}\.?\d*)", "me_power"),
    (r"(?:Cargo|CARGO QTY)[:\s]+(\d{1,6}\.?\d*)\s*(?:MT|mt|T)?", "cargo_quantity"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _file_type(filename: str) -> str:
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext == 'pdf':
        return 'pdf'
    if ext in ('xlsx', 'xls'):
        return 'excel'
    if ext == 'csv':
        return 'csv'
    return 'unknown'


def _safe_float(value) -> float | None:
    try:
        return float(str(value).strip().replace(',', ''))
    except (ValueError, TypeError):
        return None


def _safe_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%d.%m.%Y'):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            pass
    return None


def _match_column(col_header: str) -> str | None:
    """Match a spreadsheet column header to a NoonReport field name."""
    normalised = col_header.lower().strip().replace(' ', '_').replace('-', '_').replace('/', '_')
    if normalised in COLUMN_MAP:
        return COLUMN_MAP[normalised]
    # Partial match
    for key, field in COLUMN_MAP.items():
        if key in normalised or normalised in key:
            return field
    return None


def _parse_lat_lon(value_str: str, direction: str | None) -> float | None:
    """Parse latitude or longitude with optional N/S/E/W suffix."""
    val = _safe_float(value_str)
    if val is None:
        return None
    if direction and direction.upper() in ('S', 'W'):
        val = -abs(val)
    return val


# ---------------------------------------------------------------------------
# File Parsers
# ---------------------------------------------------------------------------

def _parse_csv(file_bytes: bytes) -> tuple[list[dict], list[str]]:
    """Parse CSV file. Returns (rows, errors)."""
    try:
        import pandas as pd
        df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        df.columns = [str(c).strip() for c in df.columns]
        return _dataframe_to_records(df)
    except Exception as exc:
        return [], [f"CSV parsing error: {exc}"]


def _parse_excel(file_bytes: bytes) -> tuple[list[dict], list[str]]:
    """Parse Excel file. Returns (rows, errors)."""
    try:
        import pandas as pd
        df = pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        df.columns = [str(c).strip() for c in df.columns]
        return _dataframe_to_records(df)
    except Exception as exc:
        return [], [f"Excel parsing error: {exc}"]


def _dataframe_to_records(df) -> tuple[list[dict], list[str]]:
    """Convert a DataFrame to a list of NoonReport field dicts."""
    errors = []
    col_mapping = {}  # original header → field name

    for col in df.columns:
        field = _match_column(col)
        if field:
            col_mapping[col] = field

    if not col_mapping:
        errors.append("No recognisable column names found. Check column headers match maritime report standards.")
        return [], errors

    records = []
    for idx, row in df.iterrows():
        record = {}
        for orig_col, field_name in col_mapping.items():
            raw = row.get(orig_col, '')
            if raw == '' or str(raw).upper() == 'NAN':
                continue

            if field_name in ('latitude', 'longitude', 'speed_over_ground', 'speed_through_water',
                               'distance_noon_to_noon', 'distance_to_go', 'rpm', 'wave_height',
                               'swell_height', 'me_lsfo', 'me_mgo', 'ae_lsfo', 'ae_mgo',
                               'boiler_lsfo', 'boiler_mgo', 'total_lsfo_consumption',
                               'total_mgo_consumption', 'total_fuel_consumption', 'rob_lsfo',
                               'rob_mgo', 'rob_lube_oil', 'cargo_quantity', 'draft_fore',
                               'draft_aft', 'me_power', 'scavenge_pressure', 'exhaust_temp_avg',
                               'turbo_rpm', 'slip_percentage', 'course', 'wind_speed_knots'):
                val = _safe_float(raw)
                if val is not None:
                    record[field_name] = val

            elif field_name == 'report_date':
                record[field_name] = _safe_date(raw)

            elif field_name == 'wind_force_bft':
                val = _safe_float(raw)
                if val is not None:
                    record[field_name] = int(val)

            else:
                record[field_name] = str(raw)

        if record:
            records.append(record)

    return records, errors


def _parse_pdf(file_bytes: bytes) -> tuple[list[dict], list[str]]:
    """Parse PDF using pdfplumber + regex patterns."""
    errors = []
    try:
        import pdfplumber
    except ImportError:
        return [], ["pdfplumber not installed. Install with: pip install pdfplumber"]

    try:
        record = {}
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            full_text = "\n".join(page.extract_text() or '' for page in pdf.pages)

        for pattern, field_name in PDF_PATTERNS:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if not match:
                continue
            try:
                if field_name in ('latitude', 'longitude'):
                    direction = match.group(2) if len(match.groups()) > 1 else None
                    val = _parse_lat_lon(match.group(1), direction)
                    if val is not None:
                        record[field_name] = val
                elif field_name == 'report_date':
                    record[field_name] = _safe_date(match.group(1))
                elif field_name == 'wind_force_bft':
                    val = _safe_float(match.group(1))
                    if val is not None:
                        record[field_name] = int(val)
                else:
                    val = _safe_float(match.group(1))
                    if val is not None:
                        record[field_name] = val
            except (IndexError, AttributeError):
                pass

        if record:
            return [record], errors
        else:
            errors.append("No data could be extracted from the PDF. Ensure it is a text-based (not scanned) document.")
            return [], errors

    except Exception as exc:
        return [], [f"PDF parsing error: {exc}"]


def _build_preview(records: list[dict]) -> list[dict]:
    """Return first 5 records formatted for preview."""
    return records[:5]



def _jsonable(records):
    """Dates and times from the parser become ISO strings so they fit the JSON column."""
    out = []
    for rec in records:
        out.append({k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in rec.items()})
    return out


def _coerce_temporal(rec):
    """Inverse of _jsonable for the two fields the model stores as Date and Time."""
    rec = dict(rec)
    d = rec.get('report_date')
    if isinstance(d, str):
        try:
            rec['report_date'] = datetime.strptime(d[:10], '%Y-%m-%d').date()
        except ValueError:
            rec['report_date'] = None
    t = rec.get('report_time')
    if isinstance(t, str):
        try:
            rec['report_time'] = datetime.strptime(t[:8], '%H:%M:%S').time()
        except ValueError:
            rec['report_time'] = None
    return rec


def _records_to_noon_reports(records: list[dict], vessel_id: str, voyage_id: str,
                              uploaded_by: str, organization_id: str):
    """Convert parsed field dicts to NoonReport model instances."""
    noon_reports = []
    skipped = []
    for line, rec in enumerate(records, start=1):
        rec = _coerce_temporal(rec)
        # A row without a date or a position cannot be stored honestly: do not guess either.
        if not rec.get('report_date'):
            skipped.append(f'Row {line}: no report date')
            continue
        if rec.get('latitude') in (None, '') or rec.get('longitude') in (None, ''):
            skipped.append(f'Row {line}: no position (latitude/longitude)')
            continue

        nr = NoonReport(
            organization_id=organization_id,
            vessel_id=vessel_id,
            voyage_id=voyage_id,
            report_date=rec['report_date'],
            report_time=rec.get('report_time'),   # None when the file has no time; never invented
            latitude=rec['latitude'],
            longitude=rec['longitude'],
            speed_over_ground=rec.get('speed_over_ground'),
            speed_through_water=rec.get('speed_through_water'),
            distance_noon_to_noon=rec.get('distance_noon_to_noon'),
            distance_to_go=rec.get('distance_to_go'),
            rpm=rec.get('rpm'),
            course=rec.get('course'),
            slip_percentage=rec.get('slip_percentage'),
            me_power=rec.get('me_power'),
            wind_force_bft=rec.get('wind_force_bft'),
            wind_direction=rec.get('wind_direction'),
            wind_speed_knots=rec.get('wind_speed_knots'),
            wave_height=rec.get('wave_height'),
            swell_height=rec.get('swell_height'),
            sea_state=rec.get('sea_state'),
            visibility=int(rec['visibility']) if rec.get('visibility') else None,
            me_lsfo=rec.get('me_lsfo'),
            me_mgo=rec.get('me_mgo'),
            ae_lsfo=rec.get('ae_lsfo'),
            ae_mgo=rec.get('ae_mgo'),
            boiler_lsfo=rec.get('boiler_lsfo'),
            boiler_mgo=rec.get('boiler_mgo'),
            total_lsfo_consumption=rec.get('total_lsfo_consumption'),
            total_mgo_consumption=rec.get('total_mgo_consumption'),
            total_fuel_consumption=rec.get('total_fuel_consumption'),
            rob_lsfo=rec.get('rob_lsfo'),
            rob_mgo=rec.get('rob_mgo'),
            rob_lube_oil=rec.get('rob_lube_oil'),
            cargo_quantity=rec.get('cargo_quantity'),
            draft_fore=rec.get('draft_fore'),
            draft_aft=rec.get('draft_aft'),
            scavenge_pressure=rec.get('scavenge_pressure'),
            exhaust_temp_avg=rec.get('exhaust_temp_avg'),
            turbo_rpm=rec.get('turbo_rpm'),
            uploaded_by=uploaded_by,
            raw_data=_jsonable([rec])[0],
        )
        noon_reports.append(nr)
    return noon_reports, skipped


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _content_matches(ftype, data):
    """Check magic bytes so a renamed executable or HTML file is not parsed."""
    if ftype == 'pdf':
        return data[:5] == b'%PDF-'
    if ftype == 'excel':
        return data[:4] == b'PK\x03\x04' or data[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
    if ftype == 'csv':
        if b'\x00' in data[:4096]:
            return False
        head = data[:1024].lstrip().lower()
        return not (head.startswith(b'<') or head.startswith(b'mz'))
    return False


@uploads_bp.route('/report', methods=['POST'])
@tenant_required('report:write')
def upload_report():
    """
    POST /api/uploads/report
    Upload and parse a noon report file (PDF, Excel, or CSV).
    Form data: file, vessel_id, voyage_id
    """
    try:
        user_id = g.tenant.user_id

        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part in request.'}), 400

        file = request.files['file']
        vessel_id = request.form.get('vessel_id')
        voyage_id = request.form.get('voyage_id')

        if not file or file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected.'}), 400
        if not vessel_id:
            return jsonify({'success': False, 'error': 'vessel_id is required.'}), 400
        if not _allowed_file(file.filename):
            return jsonify({'success': False, 'error': f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

        # Both must belong to the caller's organization. A foreign id looks like a missing one.
        vessel = get_scoped(Vessel, vessel_id)
        if not vessel:
            return jsonify({'success': False, 'error': 'Vessel not found.'}), 404
        if voyage_id:
            voyage = get_scoped(Voyage, voyage_id)
            if not voyage:
                return jsonify({'success': False, 'error': 'Voyage not found.'}), 404
            if voyage.vessel_id != vessel.id:
                return jsonify({'success': False, 'error': 'That voyage belongs to a different vessel.'}), 400

        filename = secure_filename(file.filename)
        ftype = _file_type(filename)
        file_bytes = file.read()
        if not _content_matches(ftype, file_bytes):
            return jsonify({'success': False, 'error': 'File content does not match its extension.'}), 400

        # ---- Parse -------------------------------------------------------- #
        records, parse_errors = [], []

        if ftype == 'csv':
            records, parse_errors = _parse_csv(file_bytes)
        elif ftype == 'excel':
            records, parse_errors = _parse_excel(file_bytes)
        elif ftype == 'pdf':
            records, parse_errors = _parse_pdf(file_bytes)
        else:
            parse_errors.append("Unsupported file type.")

        # ---- Save upload record ------------------------------------------ #
        upload = ReportUpload(
            organization_id=current_org_id(),
            vessel_id=vessel_id,
            voyage_id=voyage_id,
            uploaded_by=user_id,
            file_name=filename,
            file_type=ftype,
            parse_status='parsed' if records else 'failed',
            parsed_records=len(records),
            errors=parse_errors if parse_errors else None,
            raw_parsed_data=_jsonable(records),
        )
        db.session.add(upload)
        db.session.flush()
        audit('upload.created', 'report_upload', upload.id, file_name=filename, records=len(records))
        db.session.commit()

        # ---- Return result ----------------------------------------------- #
        parsed_fields = list(set(k for rec in records for k in rec.keys())) if records else []

        return jsonify({
            'success': True,
            'upload_id': upload.id,
            'status': upload.parse_status,
            'file_name': filename,
            'file_type': ftype,
            'records_parsed': len(records),
            'parsed_fields': parsed_fields,
            'preview': _build_preview(records),
            'errors': parse_errors,
            'message': (
                f"Successfully parsed {len(records)} record(s) from {filename}."
                if records else "No records could be extracted. See errors for details."
            ),
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Upload error: {exc}', exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': 'File upload/parsing failed.'}), 500


@uploads_bp.route('/<upload_id>', methods=['GET'])
@tenant_required('read')
def get_upload(upload_id):
    """GET /api/uploads/<id> — Get upload status and parsed data."""
    try:
        user_id = g.tenant.user_id
        upload = get_scoped(ReportUpload, upload_id)
        if not upload:
            return jsonify({'success': False, 'error': 'Upload not found.'}), 404

        result = upload.to_dict()
        result['preview'] = _build_preview(upload.raw_parsed_data or [])
        result['raw_parsed_data'] = upload.raw_parsed_data

        return jsonify({'success': True, 'upload': result}), 200

    except Exception as exc:
        current_app.logger.error(f'Get upload error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to retrieve upload.'}), 500


@uploads_bp.route('/<upload_id>/confirm', methods=['POST'])
@tenant_required('report:write')
def confirm_upload(upload_id):
    """
    POST /api/uploads/<id>/confirm
    Confirm parsed data and save to noon_reports table.
    Optionally accepts {corrections: {field: value}} in body to override parsed values.
    """
    try:
        user_id = g.tenant.user_id
        upload = get_scoped(ReportUpload, upload_id)
        if not upload:
            return jsonify({'success': False, 'error': 'Upload not found.'}), 404

        if upload.parse_status == 'confirmed':
            return jsonify({'success': False, 'error': 'Upload already confirmed.'}), 409

        raw_records = upload.raw_parsed_data or []
        if not raw_records:
            return jsonify({'success': False, 'error': 'No parsed records to confirm.'}), 400

        data = request.get_json(force=True) or {}
        corrections = data.get('corrections', {})

        # Apply corrections to each record
        if corrections:
            for rec in raw_records:
                rec.update(corrections)

        # Verify vessel
        vessel = get_scoped(Vessel, upload.vessel_id)
        if not vessel:
            return jsonify({'success': False, 'error': 'Associated vessel not found.'}), 404

        noon_reports, skipped_rows = _records_to_noon_reports(
            raw_records, upload.vessel_id, upload.voyage_id, user_id, upload.organization_id
        )

        saved_count = 0
        errors = list(skipped_rows)
        for nr in noon_reports:
            try:
                with db.session.begin_nested():  # a savepoint, so one bad row cannot undo the others
                    db.session.add(nr)
                saved_count += 1
            except Exception as row_exc:
                errors.append(f"Row skipped: {row_exc}")

        upload.parse_status = 'confirmed'
        upload.parsed_records = saved_count
        audit('upload.confirmed', 'report_upload', upload.id, saved=saved_count)
        db.session.commit()

        return jsonify({
            'success': True,
            'upload_id': upload_id,
            'saved_records': saved_count,
            'skipped_records': len(raw_records) - saved_count,
            'errors': errors[:10],  # cap to 10
            'message': f"Successfully saved {saved_count} noon report(s) to the database.",
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Confirm upload error: {exc}', exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Failed to confirm upload.'}), 500
