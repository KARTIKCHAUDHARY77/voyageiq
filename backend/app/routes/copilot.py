"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
"""
VoyageIQ AI - AI Copilot Blueprint
Chat interface backed by OpenAI GPT-4o-mini with rule-based fallback.
"""
import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import (
    CopilotConversation, CopilotMessage,
    Vessel, Voyage, NoonReport, Claim, FuelAnalytic,
)

copilot_bp = Blueprint('copilot', __name__)

# ---------------------------------------------------------------------------
# Rule-based response engine
# ---------------------------------------------------------------------------

KEYWORDS = {
    "fuel_increase":      ["fuel increas", "consumption up", "using more fuel", "fuel went up",
                           "higher consumption", "fuel spike", "fuel rise", "why is fuel"],
    "underperformance":   ["underperform", "slow speed", "speed drop", "performance drop",
                           "not performing", "poor performance", "below expect"],
    "fuel_saving":        ["save fuel", "reduce fuel", "fuel saving", "optimize fuel",
                           "cut fuel", "improve efficiency", "slow steam"],
    "route":              ["route", "routing", "best path", "optimal route", "weather route",
                           "which route", "recommend route"],
    "claim":              ["claim", "claims", "dispute", "warranty", "charter party",
                           "underperformance claim", "off-hire"],
    "vessel_status":      ["vessel status", "how is the vessel", "ship status", "current status",
                           "performance summary", "overall performance"],
}


def _classify_intent(message: str) -> str:
    msg_lower = message.lower()
    for intent, terms in KEYWORDS.items():
        if any(t in msg_lower for t in terms):
            return intent
    return "general"


def _format_fuel_reports(reports: list) -> str:
    if not reports:
        return "No recent noon reports available."
    lines = []
    for r in reports[-5:]:
        date = r.report_date.isoformat() if r.report_date else "N/A"
        fuel = float(r.total_fuel_consumption) if r.total_fuel_consumption else 0
        speed = float(r.speed_over_ground) if r.speed_over_ground else 0
        rpm = float(r.rpm) if r.rpm else 0
        bf = r.wind_force_bft or 0
        lines.append(f"  • {date}: {fuel:.1f} MT consumed, {speed:.1f} kn SOG, RPM {rpm:.0f}, Bft {bf}")
    return "
".join(lines)


def _build_vessel_context(vessel_id: str | None, voyage_id: str | None) -> dict:
    """Load vessel, voyage, recent reports, and open claims for context building."""
    context = {}

    if vessel_id:
        vessel = Vessel.query.get(vessel_id)
        if vessel:
            context['vessel'] = vessel

    if voyage_id:
        voyage = Voyage.query.get(voyage_id)
        if voyage:
            context['voyage'] = voyage
            context['reports'] = (
                NoonReport.query
                .filter_by(voyage_id=voyage_id)
                .order_by(NoonReport.report_date.desc())
                .limit(10)
                .all()
            )
            context['claims'] = (
                Claim.query
                .filter_by(voyage_id=voyage_id)
                .order_by(Claim.created_at.desc())
                .all()
            )
    elif vessel_id:
        context['reports'] = (
            NoonReport.query
            .filter_by(vessel_id=vessel_id)
            .order_by(NoonReport.report_date.desc())
            .limit(10)
            .all()
        )
        context['claims'] = (
            Claim.query
            .filter_by(vessel_id=vessel_id)
            .order_by(Claim.created_at.desc())
            .limit(5)
            .all()
        )

    return context


def _build_system_prompt(context: dict) -> str:
    parts = [
        "You are VoyageIQ Copilot, an expert maritime AI assistant specialised in vessel performance, "
        "fuel optimisation, voyage analytics, and charter party claims analysis. "
        "Respond in a professional, concise maritime-expert tone. "
        "Always provide actionable recommendations backed by data. "
        "Structure longer answers with bullet points for clarity.
"
    ]

    vessel = context.get('vessel')
    if vessel:
        parts.append(
            f"Current Vessel: {vessel.name} (IMO: {vessel.imo_number}) | "
            f"Type: {vessel.vessel_type} | "
            f"DWT: {float(vessel.deadweight_tonnage) if vessel.deadweight_tonnage else 'N/A'} MT | "
            f"Design Speed: {float(vessel.design_speed) if vessel.design_speed else 'N/A'} kn | "
            f"Warranted Consumption: {float(vessel.warranted_consumption) if vessel.warranted_consumption else 'N/A'} MT/day
"
        )

    voyage = context.get('voyage')
    if voyage:
        parts.append(
            f"Active Voyage: {voyage.voyage_number} | "
            f"{voyage.departure_port} → {voyage.arrival_port} | "
            f"Status: {voyage.status} | "
            f"CP Speed: {float(voyage.charter_party_speed) if voyage.charter_party_speed else 'N/A'} kn | "
            f"CP Consumption: {float(voyage.charter_party_consumption) if voyage.charter_party_consumption else 'N/A'} MT/day
"
        )

    reports = context.get('reports', [])
    if reports:
        parts.append(f"Recent Performance Data (last {len(reports)} noon reports):
{_format_fuel_reports(reports)}
")

    claims = context.get('claims', [])
    open_claims = [c for c in claims if c.status == 'open']
    if open_claims:
        claim_lines = [
            f"  • {c.claim_type} | Severity: {c.severity} | Impact: ${float(c.estimated_impact_usd):,.0f}"
            for c in open_claims
            if c.estimated_impact_usd
        ]
        parts.append(f"Open Claims ({len(open_claims)}):
" + "
".join(claim_lines) + "
")

    return "
".join(parts)


def _rule_based_response(intent: str, message: str, context: dict) -> tuple[str, list, list]:
    """
    Returns (response_text, recommendations, warnings).
    """
    vessel = context.get('vessel')
    voyage = context.get('voyage')
    reports = context.get('reports', [])
    claims = context.get('claims', [])

    vessel_name = vessel.name if vessel else "the vessel"
    warnings = []
    recommendations = []

    # ------------------------------------------------------------------ #
    if intent == "fuel_increase":
        recent = reports[:5]
        avg_fuel = 0.0
        avg_bf = 0.0
        avg_rpm = 0.0
        if recent:
            fuels = [float(r.total_fuel_consumption) for r in recent if r.total_fuel_consumption]
            bfs = [r.wind_force_bft for r in recent if r.wind_force_bft]
            rpms = [float(r.rpm) for r in recent if r.rpm]
            avg_fuel = sum(fuels) / len(fuels) if fuels else 0
            avg_bf = sum(bfs) / len(bfs) if bfs else 0
            avg_rpm = sum(rpms) / len(rpms) if rpms else 0

        text = (
            f"**Fuel Consumption Analysis — {vessel_name}**

"
            f"Based on the {len(recent)} most recent noon reports:
"
            f"• Average daily fuel consumption: **{avg_fuel:.1f} MT/day**
"
            f"• Average wind force: **Beaufort {avg_bf:.1f}**
"
            f"• Average RPM: **{avg_rpm:.0f}**

"
            "**Likely causes of increased consumption:**
"
            "1. **Adverse weather** — Headwinds (Bft 5+) can increase fuel burn by 10–30%.
"
            "2. **Speed increase** — Fuel consumption scales with the cube of speed; a 1-knot increase "
            "at 14 kn can raise consumption by ~20%.
"
            "3. **Propeller fouling** — Biofouling adds resistance, reducing efficiency.
"
            "4. **Engine derating / high RPM** — RPM above design point wastes fuel.
"
            "5. **Heavy displacement / trim** — Poor trim adds up to 5% resistance.

"
            "**Recommended actions:**
"
            "• Cross-check against Charter Party warranted figures to quantify the variance.
"
            "• Review trim logs and optimise fore/aft draft balance.
"
            "• Consider slow-steaming if schedule permits — each 0.5-knot reduction saves ~8% fuel.
"
            "• Schedule next underwater inspection if more than 6 months since last drydock."
        )
        recommendations = [
            "Optimise vessel trim to reduce resistance by up to 5%.",
            "Consider slow-steaming — reducing speed by 1 knot saves ~15–20% fuel.",
            "Request full engine performance test to identify power loss.",
            "Evaluate weather routing to avoid headwind sectors.",
        ]
        if avg_bf > 5:
            warnings.append(f"Average Beaufort {avg_bf:.1f} — adverse weather is likely contributing significantly.")
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    elif intent == "underperformance":
        cp_speed = float(voyage.charter_party_speed) if voyage and voyage.charter_party_speed else None
        recent = reports[:5]
        avg_sog = 0.0
        if recent:
            sogs = [float(r.speed_over_ground) for r in recent if r.speed_over_ground]
            avg_sog = sum(sogs) / len(sogs) if sogs else 0

        speed_gap = ""
        if cp_speed and avg_sog:
            gap = cp_speed - avg_sog
            speed_gap = f"Speed gap vs CP: **{gap:+.2f} kn** (CP warranted {cp_speed:.1f} kn, actual {avg_sog:.1f} kn).

"
            if gap > 0.5:
                warnings.append(f"Speed is {gap:.2f} kn below CP-warranted speed — potential underperformance claim exposure.")

        text = (
            f"**Vessel Underperformance Assessment — {vessel_name}**

"
            f"{speed_gap}"
            "**Primary underperformance drivers to investigate:**
"
            "1. **Hull & Propeller Fouling** — Biofouling causes up to 10–15% power loss and is the #1 reason for speed loss.
"
            "2. **Engine Derating** — Main engine may be operating below rated MCR, limiting shaft power.
"
            "3. **Adverse Current** — Ocean currents opposing the vessel reduce SOG without affecting STW.
"
            "4. **Displacement** — Heavy cargo loading increases draft and resistance.
"
            "5. **Weather Conditions** — Sustained Bft 5+ head seas reduce speed significantly.

"
            "**Charter Party Implications:**
"
            "• If weather-adjusted speed is still below CP warranted speed, Owners may be liable for underperformance claims.
"
            "• Ensure weather logs are properly documented (NOAA/ECMWF data) to distinguish weather from mechanical causes.
"
            "• Review CP speed/consumption warranty clauses for applicable corrections (NYPE, BALTIME, etc.)."
        )
        recommendations = [
            "Commission an independent performance analysis using full speed-power data.",
            "Obtain certified weather data to support/defend any CP performance claim.",
            "Consider hull and propeller cleaning at next suitable port.",
            "Review ME indicator cards and performance reports.",
        ]
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    elif intent == "fuel_saving":
        text = (
            f"**Fuel Saving Recommendations — {vessel_name}**

"
            "**1. Speed Optimisation (Slow Steaming)**
"
            "   • Fuel consumption ∝ speed³. Reducing speed from 14 to 12 kn saves ~27% fuel.
"
            "   • Identify schedule slack and request charterer approval for slow steaming.

"
            "**2. Trim Optimisation**
"
            "   • Optimal trim can reduce resistance by 3–5%. Use trim optimisation tables.
"
            "   • Aim for even keel or slight trim by stern within stability limits.

"
            "**3. Weather Routing**
"
            "   • Use certified weather routing services to avoid head seas.
"
            "   • Tailwinds and favourable currents can save 5–8% fuel.

"
            "**4. Engine Load Management**
"
            "   • Operate ME at 75–85% MCR for best SFOC (specific fuel oil consumption).
"
            "   • Avoid excessive generator running — use shore power at berth.

"
            "**5. Hull Maintenance**
"
            "   • Keep hull clean — schedule underwater cleaning every 6–12 months.
"
            "   • Apply low-friction antifouling coating at drydock.

"
            "**6. Voyage Planning**
"
            "   • Use JIT (just-in-time) arrival to avoid waiting at anchor at full speed.
"
            "   • Coordinate with port for berth readiness before departure."
        )
        recommendations = [
            "Reduce speed by 1 knot to save ~15–20% fuel — check ETA margin first.",
            "Optimise trim using loading computer for current displacement.",
            "Subscribe to a weather routing service (e.g., StormGeo, MeteoGroup).",
            "Implement JIT arrival policy — align ETA with berth availability.",
        ]
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    elif intent == "route":
        voyage_info = ""
        if voyage:
            voyage_info = f"Current voyage: **{voyage.departure_port} → {voyage.arrival_port}**

"

        text = (
            f"**Route Optimisation Recommendations — {vessel_name}**

"
            f"{voyage_info}"
            "**Route Selection Principles:**
"
            "1. **Optimal (Balanced)** — Best trade-off between fuel, time, and safety. Recommended as default.
"
            "2. **Eco Route** — Diverts slightly to avoid head seas; 3–8% fuel saving but adds 6–12 hours.
"
            "3. **Fastest Route** — Direct great-circle; highest speed/fuel; use only if schedule-critical.
"
            "4. **Safest Route** — Avoids storm zones; ideal for heavy weather periods or sensitive cargo.

"
            "**Current Weather Considerations:**
"
            "• Check for active cyclone/typhoon advisories in the planned area.
"
            "• Monitor North Atlantic/Pacific ridge for favourable routing in winter months.
"
            "• Review current systems (ENSO, Gulf Stream, Kuroshio) that affect speed made good.

"
            "**Use the Route Optimisation tool** in the VoyageIQ platform to generate and compare all four route variants "
            "with real-time weather overlays and fuel cost breakdowns."
        )
        recommendations = [
            "Use the VoyageIQ Route Optimizer to generate all 4 route options with cost comparison.",
            "Check for any active weather warnings (WMO, NAVTEX) along the planned track.",
            "Consider the Eco Route if schedule allows — significant fuel savings available.",
        ]
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    elif intent == "claim":
        open_claims = [c for c in claims if c.status == 'open']
        total_impact = sum(float(c.estimated_impact_usd) for c in open_claims if c.estimated_impact_usd)

        claim_lines = "
".join([
            f"  • **{c.claim_type}** | Severity: {c.severity.upper()} | "
            f"Impact: ${float(c.estimated_impact_usd):,.0f} | Period: "
            f"{c.period_start.isoformat() if c.period_start else 'N/A'} – "
            f"{c.period_end.isoformat() if c.period_end else 'N/A'}"
            for c in open_claims if c.estimated_impact_usd
        ]) or "  No open claims found."

        text = (
            f"**Claims Summary — {vessel_name}**

"
            f"**Open Claims: {len(open_claims)} | Estimated Total Impact: ${total_impact:,.0f}**

"
            f"{claim_lines}

"
            "**Claim Management Guidance:**
"
            "• Ensure all supporting data (weather logs, speed logs, ME performance records) is archived.
"
            "• Review Charter Party clauses for speed/consumption warranties and applicable corrections.
"
            "• For underperformance claims, obtain independent weather data (NOAA/ECMWF) to support your position.
"
            "• Engage P&I Club or legal counsel for claims exceeding $50,000.
"
            "• Issue formal Protest Letters for weather-related performance deductions."
        )
        if total_impact > 100_000:
            warnings.append(f"Total open claim exposure is ${total_impact:,.0f} — recommend urgent review with legal/P&I.")
        recommendations = [
            "Archive all noon reports and weather logs for claim period.",
            "Obtain certified independent weather analysis for disputed periods.",
            "Issue formal Letter of Protest for charter party weather corrections.",
        ]
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    elif intent == "vessel_status":
        recent = reports[:3]
        status_lines = _format_fuel_reports(recent)
        perf_score = float(voyage.performance_score) if voyage and voyage.performance_score else None
        health_score = float(voyage.health_score) if voyage and voyage.health_score else None

        scores_text = ""
        if perf_score is not None:
            scores_text += f"• Performance Score: **{perf_score:.1f}/100**
"
        if health_score is not None:
            scores_text += f"• Health Score: **{health_score:.1f}/100**
"

        text = (
            f"**Vessel Status Overview — {vessel_name}**

"
            f"{scores_text}"
            f"
**Recent Performance (noon reports):**
{status_lines}

"
            "Use the VoyageIQ dashboard for interactive charts and trend analysis. "
            "All metrics update automatically as new noon reports are uploaded."
        )
        if perf_score and perf_score < 70:
            warnings.append(f"Performance score {perf_score:.0f}/100 is below the 70-point threshold — investigation recommended.")
        recommendations = ["Upload latest noon reports to refresh the performance dashboard."]
        return text, recommendations, warnings

    # ------------------------------------------------------------------ #
    else:  # general
        text = (
            "I'm **VoyageIQ Copilot**, your maritime intelligence assistant. I can help you with:

"
            "• **Fuel Analysis** — consumption trends, variance from CP, optimisation tips
"
            "• **Performance Assessment** — speed/consumption gap analysis, underperformance detection
"
            "• **Route Recommendations** — optimal, eco, fastest, and safest route options
"
            "• **Claims Management** — open claims, exposure quantification, documentation guidance
"
            "• **Vessel Status** — real-time performance scores and noon report summaries

"
            "Try asking something like:
"
            "  *\"Why has fuel consumption increased this week?\"*
"
            "  *\"What are the best fuel-saving measures available?\"*
"
            "  *\"Show me the current open claims and their impact.\"*
"
            "  *\"What is the recommended route from Singapore to Rotterdam?\"*"
        )
        recommendations = ["Provide vessel and voyage context for more specific analysis."]
        return text, recommendations, warnings


def _call_openai(system_prompt: str, history: list, user_message: str, api_key: str) -> str:
    """Call OpenAI Chat Completions API. Raises on failure."""
    import json
    import urllib.request

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:  # last 10 messages for context window
        messages.append({"role": msg['role'], "content": msg['content']})
    messages.append({"role": "user", "content": user_message})

    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.4,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        result = json.loads(resp.read())
    return result['choices'][0]['message']['content']


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@copilot_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    """
    POST /api/copilot/chat
    Main copilot chat endpoint.
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json(force=True) or {}

        user_message = (data.get('message') or '').strip()
        conversation_id = data.get('conversation_id')
        vessel_id = data.get('vessel_id')
        voyage_id = data.get('voyage_id')

        if not user_message:
            return jsonify({'success': False, 'error': 'message is required.'}), 400

        # ---- Load or create conversation --------------------------------- #
        if conversation_id:
            conversation = CopilotConversation.query.filter_by(
                id=conversation_id, user_id=user_id
            ).first()
            if not conversation:
                return jsonify({'success': False, 'error': 'Conversation not found.'}), 404
        else:
            conversation = CopilotConversation(
                user_id=user_id,
                vessel_id=vessel_id,
                voyage_id=voyage_id,
            )
            db.session.add(conversation)
            db.session.flush()

        # Override vessel/voyage context from conversation if not provided
        vessel_id = vessel_id or conversation.vessel_id
        voyage_id = voyage_id or conversation.voyage_id

        # ---- Build context ----------------------------------------------- #
        context = _build_vessel_context(vessel_id, voyage_id)
        system_prompt = _build_system_prompt(context)

        # ---- Load conversation history ------------------------------------ #
        history = [m.to_dict() for m in conversation.messages.order_by(CopilotMessage.created_at).all()]

        # ---- Save user message ------------------------------------------- #
        user_msg = CopilotMessage(
            conversation_id=conversation.id,
            role='user',
            content=user_message,
        )
        db.session.add(user_msg)

        # ---- Generate response ------------------------------------------- #
        api_key = current_app.config.get('OPENAI_API_KEY', '')
        ai_used = False
        response_text = ''
        recommendations = []
        warnings = []

        if api_key:
            try:
                response_text = _call_openai(system_prompt, history, user_message, api_key)
                ai_used = True
            except Exception as ai_exc:
                current_app.logger.warning(f'OpenAI call failed, falling back to rule-based: {ai_exc}')

        if not ai_used:
            intent = _classify_intent(user_message)
            response_text, recommendations, warnings = _rule_based_response(intent, user_message, context)

        # ---- Save assistant message -------------------------------------- #
        assistant_msg = CopilotMessage(
            conversation_id=conversation.id,
            role='assistant',
            content=response_text,
            metadata={
                'ai_used': ai_used,
                'recommendations': recommendations,
                'warnings': warnings,
            },
        )
        db.session.add(assistant_msg)
        db.session.commit()

        return jsonify({
            'success': True,
            'conversation_id': conversation.id,
            'message_id': assistant_msg.id,
            'response': response_text,
            'metadata': {
                'ai_used': ai_used,
                'model': 'gpt-4o-mini' if ai_used else 'rule-based',
                'recommendations': recommendations,
                'warnings': warnings,
                'vessel_context_loaded': bool(context.get('vessel')),
                'voyage_context_loaded': bool(context.get('voyage')),
                'reports_in_context': len(context.get('reports', [])),
            },
            'timestamp': assistant_msg.created_at.isoformat(),
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Copilot chat error: {exc}', exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Copilot service error. Please try again.'}), 500


@copilot_bp.route('/conversations', methods=['GET'])
@jwt_required()
def list_conversations():
    """GET /api/copilot/conversations — List current user's conversations."""
    try:
        user_id = get_jwt_identity()
        conversations = (
            CopilotConversation.query
            .filter_by(user_id=user_id)
            .order_by(CopilotConversation.created_at.desc())
            .limit(50)
            .all()
        )

        result = []
        for conv in conversations:
            last_msg = conv.messages.order_by(CopilotMessage.created_at.desc()).first()
            msg_count = conv.messages.count()
            vessel = Vessel.query.get(conv.vessel_id) if conv.vessel_id else None
            result.append({
                'id': conv.id,
                'vessel_id': conv.vessel_id,
                'voyage_id': conv.voyage_id,
                'vessel_name': vessel.name if vessel else None,
                'message_count': msg_count,
                'last_message': last_msg.content[:120] + '…' if last_msg and len(last_msg.content) > 120 else (last_msg.content if last_msg else None),
                'last_message_at': last_msg.created_at.isoformat() if last_msg else None,
                'created_at': conv.created_at.isoformat(),
            })

        return jsonify({'success': True, 'conversations': result, 'count': len(result)}), 200

    except Exception as exc:
        current_app.logger.error(f'List conversations error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to retrieve conversations.'}), 500


@copilot_bp.route('/conversations/<conversation_id>', methods=['GET'])
@jwt_required()
def get_conversation(conversation_id):
    """GET /api/copilot/conversations/<id> — Get all messages in a conversation."""
    try:
        user_id = get_jwt_identity()
        conversation = CopilotConversation.query.filter_by(
            id=conversation_id, user_id=user_id
        ).first()

        if not conversation:
            return jsonify({'success': False, 'error': 'Conversation not found.'}), 404

        messages = [m.to_dict() for m in conversation.messages.order_by(CopilotMessage.created_at).all()]
        vessel = Vessel.query.get(conversation.vessel_id) if conversation.vessel_id else None
        voyage = Voyage.query.get(conversation.voyage_id) if conversation.voyage_id else None

        return jsonify({
            'success': True,
            'conversation': {
                'id': conversation.id,
                'vessel_id': conversation.vessel_id,
                'voyage_id': conversation.voyage_id,
                'vessel_name': vessel.name if vessel else None,
                'voyage_number': voyage.voyage_number if voyage else None,
                'created_at': conversation.created_at.isoformat(),
                'message_count': len(messages),
            },
            'messages': messages,
        }), 200

    except Exception as exc:
        current_app.logger.error(f'Get conversation error: {exc}', exc_info=True)
        return jsonify({'success': False, 'error': 'Failed to retrieve conversation.'}), 500
