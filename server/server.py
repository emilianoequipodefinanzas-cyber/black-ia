#!/usr/bin/env python3
"""BLACK.IA - Python server with yfinance for real-time financial data"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import numpy as np
from datetime import datetime
import socket
import re

app = Flask(__name__)
CORS(app, origins="*")

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

def safe_float(val):
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return float(val)
    except:
        return None

def get_quote(symbol):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="2d", interval="1d")
        if hist.empty:
            return None
        price = safe_float(hist['Close'].iloc[-1])
        prev = safe_float(hist['Close'].iloc[-2]) if len(hist) > 1 else price
        change = price - prev if price and prev else 0
        change_pct = (change / prev * 100) if prev else 0
        info = ticker.fast_info
        return {
            "symbol": symbol,
            "name": getattr(info, 'exchange', symbol),
            "price": price,
            "change": safe_float(change),
            "changePct": safe_float(change_pct),
            "currency": getattr(info, 'currency', 'USD'),
        }
    except Exception as e:
        print(f"Quote error {symbol}: {e}")
        return None

def get_multiple_quotes(symbols):
    return [q for q in [get_quote(s) for s in symbols] if q]

def get_full_analysis(symbol):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y", interval="1d")
        if hist.empty or len(hist) < 20:
            return None
        closes = hist['Close'].values.tolist()
        highs = hist['High'].values.tolist()
        lows = hist['Low'].values.tolist()
        price = closes[-1]
        ma20 = float(np.mean(closes[-20:])) if len(closes) >= 20 else None
        ma50 = float(np.mean(closes[-50:])) if len(closes) >= 50 else None
        ma200 = float(np.mean(closes[-200:])) if len(closes) >= 200 else None
        def calc_ema(data, period):
            if len(data) < period:
                return None
            k = 2 / (period + 1)
            ema = sum(data[:period]) / period
            for v in data[period:]:
                ema = v * k + ema * (1 - k)
            return float(ema)
        ema9 = calc_ema(closes, 9)
        def calc_rsi(data, period=14):
            if len(data) < period + 1:
                return None
            deltas = [data[i] - data[i-1] for i in range(1, len(data))]
            recent = deltas[-period:]
            gains = sum(d for d in recent if d > 0) / period
            losses = sum(abs(d) for d in recent if d < 0) / period
            if losses == 0:
                return 100.0
            return float(100 - (100 / (1 + gains / losses)))
        rsi = calc_rsi(closes)
        def cluster(levels):
            out = []
            for lvl in levels:
                if not any(abs(c - lvl) / lvl < 0.01 for c in out):
                    out.append(lvl)
            return [round(x, 2) for x in out[:3]]
        resistance = cluster(sorted(highs[-50:], reverse=True))
        support = cluster(sorted(lows[-50:]))
        score = 0
        if ma20 and ma50:
            if price > ma20 and ma20 > ma50:
                score += 2
            elif price < ma20 and ma20 < ma50:
                score -= 2
        if ma200:
            score += 1 if price > ma200 else -1
        if ma50 and ma200:
            score += 2 if ma50 > ma200 else -2
        if rsi is not None:
            if rsi < 30:
                score += 2
            elif rsi > 70:
                score -= 2
            else:
                score += 0.5 if rsi > 50 else -0.5
        if ema9:
            score += 1 if price > ema9 else -1
        entry_zone = stop_loss = target1 = target2 = None
        if support and resistance:
            ns, nr = support[0], resistance[0]
            ma_levels = [x for x in [ma20, ma50, ma200] if x]
            nearest_ma = min(ma_levels, key=lambda x: abs(x - price)) if ma_levels else None
            if score > 0:
                base = max(ns, nearest_ma or 0)
                entry_zone = {"low": round(base * 0.99, 2), "high": round(base * 1.01, 2)}
                stop_loss = round(ns * 0.97, 2)
                target1 = round(nr, 2)
                target2 = round(nr * 1.05, 2)
            else:
                entry_zone = {"low": round(nr * 0.99, 2), "high": round(nr * 1.01, 2)}
                stop_loss = round(nr * 1.03, 2)
                target1 = round(ns, 2)
                target2 = round(ns * 0.95, 2)
        overall = "COMPRAR" if score >= 3 else "VENDER" if score <= -3 else "ACUMULAR" if score > 0 else "ESPERAR"
        return {
            "symbol": symbol,
            "price": round(price, 2),
            "ma20": round(ma20, 2) if ma20 else None,
            "ma50": round(ma50, 2) if ma50 else None,
            "ma200": round(ma200, 2) if ma200 else None,
            "ema9": round(ema9, 2) if ema9 else None,
            "rsi": round(rsi, 2) if rsi else None,
            "support": support,
            "resistance": resistance,
            "overallSignal": overall,
            "score": score,
            "entryZone": entry_zone,
            "stopLoss": stop_loss,
            "target1": target1,
            "target2": target2,
            "signals": [],
        }
    except Exception as e:
        print(f"Analysis error {symbol}: {e}")
        return None

def get_news(symbol):
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news or []
        result = []
        for n in news[:5]:
            content = n.get('content', {})
            title = content.get('title', n.get('title', ''))
            url = content.get('canonicalUrl', {}).get('url', '') or n.get('link', '')
            pub = content.get('provider', {}).get('displayName', n.get('publisher', ''))
            ts = content.get('pubDate', '') or str(n.get('providerPublishTime', ''))
            thumb = None
            try:
                thumb = content.get('thumbnail', {}).get('originalUrl', '')
            except:
                pass
            if title:
                result.append({"title": title, "url": url, "source": pub, "time": ts[:10] if ts else '', "thumbnail": thumb})
        return result
    except Exception as e:
        print(f"News error {symbol}: {e}")
        return []

MACRO_SYMBOLS = {"dxy": "DX-Y.NYB", "wti": "CL=F", "usBond": "^TNX", "tbill": "^IRX", "mxnusd": "MXN=X", "gold": "GC=F", "bmv": "^MXX"}

def get_macro():
    quotes = {key: get_quote(sym) for key, sym in MACRO_SYMBOLS.items()}
    return {
        "quotes": quotes,
        "centralBanks": {"fed": {"rate": 5.25, "label": "Fed Funds Rate"}, "banxico": {"rate": 11.00, "label": "Tasa Banxico"}},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

SYMBOL_MAP = {
    'bitcoin': 'BTC-USD', 'btc': 'BTC-USD', 'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
    'solana': 'SOL-USD', 'sol': 'SOL-USD', 'spy': 'SPY', 'sp500': 'SPY',
    'qqq': 'QQQ', 'nasdaq': 'QQQ', 'nvidia': 'NVDA', 'nvda': 'NVDA',
    'apple': 'AAPL', 'aapl': 'AAPL', 'microsoft': 'MSFT', 'msft': 'MSFT',
    'amazon': 'AMZN', 'amzn': 'AMZN', 'tesla': 'TSLA', 'tsla': 'TSLA',
    'oro': 'GLD', 'gold': 'GLD', 'gld': 'GLD', 'bonos': 'BND', 'bnd': 'BND',
    'meta': 'META', 'google': 'GOOGL', 'googl': 'GOOGL',
    'esg': 'ESGU', 'icln': 'ICLN', 'solar': 'TAN', 'tan': 'TAN',
    'petroleo': 'CL=F', 'wti': 'CL=F', 'dolar': 'DX-Y.NYB', 'dxy': 'DX-Y.NYB',
}

def detect_symbol(msg):
    lower = msg.lower()
    for key, sym in SYMBOL_MAP.items():
        if key in lower:
            return sym
    m = re.search(r'\b([A-Z]{2,5})\b', msg)
    return m.group(1) if m else None

def fmt_q(q):
    if not q:
        return "N/D"
    sign = "+" if q["changePct"] >= 0 else ""
    return f"${q['price']:.2f} ({sign}{q['changePct']:.2f}% hoy)"

PORTFOLIOS = {
    "conservative": [
        {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "pct": 25, "type": "Renta Fija"},
        {"symbol": "GLD", "name": "SPDR Gold Shares", "pct": 10, "type": "Commodities"},
        {"symbol": "SPY", "name": "S&P 500 ETF", "pct": 10, "type": "Acciones USA"},
        {"symbol": "VIG", "name": "Vanguard Dividend Appreciation ETF", "pct": 8, "type": "Dividendos"},
        {"symbol": "VYM", "name": "Vanguard High Dividend Yield ETF", "pct": 7, "type": "Dividendos"},
        {"symbol": "VTIP", "name": "Vanguard Short-Term Inflation ETF", "pct": 6, "type": "Renta Fija"},
        {"symbol": "JNJ", "name": "Johnson & Johnson", "pct": 5, "type": "Salud"},
        {"symbol": "PG", "name": "Procter & Gamble", "pct": 5, "type": "Consumo"},
        {"symbol": "KO", "name": "Coca-Cola", "pct": 4, "type": "Consumo"},
        {"symbol": "VNQ", "name": "Vanguard Real Estate ETF", "pct": 4, "type": "REIT"},
        {"symbol": "ESGU", "name": "iShares MSCI USA ESG ETF", "pct": 4, "type": "ESG"},
        {"symbol": "CRBN", "name": "iShares Low Carbon Target ETF", "pct": 3, "type": "ESG"},
        {"symbol": "SHY", "name": "iShares 1-3 Year Treasury Bond ETF", "pct": 3, "type": "Renta Fija"},
        {"symbol": "SCHZ", "name": "Schwab US Aggregate Bond ETF", "pct": 3, "type": "Renta Fija"},
        {"symbol": "CASH", "name": "Reserva de liquidez", "pct": 3, "type": "Liquidez"},
    ],
    "moderate": [
        {"symbol": "SPY", "name": "S&P 500 ETF", "pct": 20, "type": "Acciones USA"},
        {"symbol": "QQQ", "name": "Nasdaq-100 ETF", "pct": 12, "type": "Tecnologia"},
        {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "pct": 12, "type": "Renta Fija"},
        {"symbol": "VXUS", "name": "Vanguard Total International", "pct": 8, "type": "Internacional"},
        {"symbol": "GLD", "name": "SPDR Gold Shares", "pct": 7, "type": "Commodities"},
        {"symbol": "AAPL", "name": "Apple Inc.", "pct": 6, "type": "Tecnologia"},
        {"symbol": "MSFT", "name": "Microsoft Corp.", "pct": 6, "type": "Tecnologia"},
        {"symbol": "VNQ", "name": "Vanguard Real Estate ETF", "pct": 5, "type": "REIT"},
        {"symbol": "VIG", "name": "Vanguard Dividend Appreciation", "pct": 5, "type": "Dividendos"},
        {"symbol": "ICLN", "name": "iShares Global Clean Energy ETF", "pct": 4, "type": "ESG"},
        {"symbol": "NVDA", "name": "NVIDIA Corp.", "pct": 4, "type": "Tecnologia"},
        {"symbol": "BTC-USD", "name": "Bitcoin", "pct": 4, "type": "Cripto"},
        {"symbol": "ESGU", "name": "iShares MSCI USA ESG ETF", "pct": 3, "type": "ESG"},
        {"symbol": "VWO", "name": "Vanguard Emerging Markets ETF", "pct": 3, "type": "Emergentes"},
        {"symbol": "CASH", "name": "Reserva de liquidez", "pct": 1, "type": "Liquidez"},
    ],
    "aggressive": [
        {"symbol": "QQQ", "name": "Nasdaq-100 ETF", "pct": 18, "type": "Tecnologia"},
        {"symbol": "NVDA", "name": "NVIDIA Corp.", "pct": 10, "type": "Tecnologia"},
        {"symbol": "BTC-USD", "name": "Bitcoin", "pct": 10, "type": "Cripto"},
        {"symbol": "TSLA", "name": "Tesla Inc.", "pct": 8, "type": "Tecnologia"},
        {"symbol": "ETH-USD", "name": "Ethereum", "pct": 7, "type": "Cripto"},
        {"symbol": "SPY", "name": "S&P 500 ETF", "pct": 7, "type": "Acciones USA"},
        {"symbol": "META", "name": "Meta Platforms", "pct": 6, "type": "Tecnologia"},
        {"symbol": "AMZN", "name": "Amazon.com Inc.", "pct": 6, "type": "Tecnologia"},
        {"symbol": "GOOGL", "name": "Alphabet (Google)", "pct": 5, "type": "Tecnologia"},
        {"symbol": "ARKK", "name": "ARK Innovation ETF", "pct": 5, "type": "Innovacion"},
        {"symbol": "SOL-USD", "name": "Solana", "pct": 5, "type": "Cripto"},
        {"symbol": "ICLN", "name": "iShares Global Clean Energy ETF", "pct": 4, "type": "ESG"},
        {"symbol": "VWO", "name": "Vanguard Emerging Markets ETF", "pct": 4, "type": "Emergentes"},
        {"symbol": "TAN", "name": "Invesco Solar ETF", "pct": 3, "type": "ESG"},
        {"symbol": "CASH", "name": "Reserva de liquidez", "pct": 2, "type": "Liquidez"},
    ],
}

def detect_intent(lower):
    """Motor de intención: clasifica el tipo de consulta"""
    if any(w in lower for w in ["rapido", "rápido", "garantizado", "seguro 100", "duplicar", "doblar", "x2", "x10", "overnight"]):
        return "RIESGO_ALTO"
    if any(w in lower for w in ["perdi", "perdí", "mal", "ayuda", "estoy perdido", "no se que", "no sé qué", "me fue mal", "todo cae", "crash"]):
        return "EMOCIONAL"
    if any(w in lower for w in ["cuanto gano", "cuánto gano", "cuanto puedo ganar", "cuánto puedo ganar", "rendimiento", "ganancias"]):
        return "EXPECTATIVA"
    if any(w in lower for w in ["compro", "vendo", "entro", "salgo", "debo comprar", "debería comprar", "es momento", "buen momento"]):
        return "DECISION"
    if any(w in lower for w in ["rsi", "macd", "media movil", "soporte", "resistencia", "fibonacci", "velas", "patron", "indicador"]):
        return "TECNICA"
    if any(w in lower for w in ["stop loss", "stop-loss", "donde poner stop", "nivel de stop"]):
        return "TECNICA"
    if any(w in lower for w in ["win rate", "winrate", "tasa de acierto", "soy rentable"]):
        return "TECNICA"
    return "GENERAL"


def extract_context(message, risk_level):
    """Motor de contexto: extrae capital, nivel y objetivo del mensaje"""
    ctx = {"capital": None, "nivel": None, "objetivo": None}
    m = re.search(r'\$?\s*(\d[\d,\.]*)', message)
    if m:
        try:
            ctx["capital"] = float(m.group(1).replace(",", ""))
        except:
            pass
    lower = message.lower()
    if any(w in lower for w in ["principiante", "nuevo", "empezando", "no se", "no sé", "nunca he"]):
        ctx["nivel"] = "principiante"
    elif any(w in lower for w in ["intermedio", "algo de experiencia", "llevo tiempo"]):
        ctx["nivel"] = "intermedio"
    elif any(w in lower for w in ["avanzado", "experto", "trader", "profesional"]):
        ctx["nivel"] = "avanzado"
    if any(w in lower for w in ["largo plazo", "largo tiempo", "años", "jubilacion", "jubilación", "retiro"]):
        ctx["objetivo"] = "largo_plazo"
    elif any(w in lower for w in ["trading", "corto plazo", "rapido", "rápido", "diario", "semanal"]):
        ctx["objetivo"] = "trading"
    return ctx


def build_structured_response(direct, context, risk, recommendation, closing):
    """Plantilla universal: 5 partes estructuradas"""
    return f"{direct}\n\n{context}\n\nEl principal riesgo es {risk}\n\n{recommendation}\n\n{closing}"


def build_chat_response(message, risk_level, quotes, analysis, news):
    lower = message.lower()
    pm = {q["symbol"]: q for q in quotes}
    intent = detect_intent(lower)
    ctx = extract_context(message, risk_level)

    risk_profile = {
        "conservative": "conservador (prioriza protección de capital)",
        "moderate": "moderado (equilibrio riesgo/retorno)",
        "aggressive": "agresivo (busca máximo crecimiento)",
    }.get(risk_level or "moderate", "no definido")

    capital_str = f"${ctx['capital']:,.0f}" if ctx["capital"] else "tu capital"

    # ── MODO RIESGO ALTO ──────────────────────────────────────────────────────
    if intent == "RIESGO_ALTO" and not analysis:
        return build_structured_response(
            "Entiendo la intención, pero es importante ser directo: estrategias que prometen resultados rápidos o garantizados implican un riesgo muy alto.",
            f"En los mercados financieros, a mayor velocidad de ganancia esperada, mayor es la probabilidad de pérdida. Esto aplica para cualquier activo, incluyendo cripto, forex o acciones.",
            "sobreapalancarte o tomar decisiones impulsivas buscando resultados inmediatos, lo que puede llevarte a perder más de lo que planeabas invertir.",
            f"Una estrategia más sólida para un perfil {risk_profile} sería buscar crecimiento progresivo: definir un % de riesgo por operación (máximo 1-2% de tu cuenta), construir consistencia y escalar gradualmente.",
            f"Si quieres, puedo ayudarte a diseñar un plan realista con {capital_str} que proteja tu capital mientras crece."
        )

    # ── MODO EMOCIONAL ────────────────────────────────────────────────────────
    if intent == "EMOCIONAL" and not analysis:
        return build_structured_response(
            "Antes que nada: perder dinero o estar en una racha difícil es parte del proceso, incluso para traders con años de experiencia.",
            "Lo más importante ahora no es recuperar lo perdido rápido, sino entender qué ocurrió: si fue una decisión emocional, si el mercado se movió en contra de tu análisis, o si hubo una falla en tu sistema.",
            "intentar recuperar pérdidas rápidamente, lo que suele llevar a errores más grandes y pérdidas mayores.",
            "La mejor opción es pausar, revisar tus operaciones con calma y detectar el patrón que generó el problema. Una pérdida bien analizada es una lección que vale más que la pérdida misma.",
            "Si quieres, cuéntame qué pasó y te ayudo a identificar qué pudo haber fallado y cómo evitarlo en el futuro."
        )

    # ── MODO EXPECTATIVA ──────────────────────────────────────────────────────
    if intent == "EXPECTATIVA" and not analysis:
        ranges = ""
        if ctx["capital"]:
            c = ctx["capital"]
            ranges = f"\n\nCon {capital_str}, algunos rangos realistas:\n- Conservador (2-4%/mes): ${c*0.02:,.0f} - ${c*0.04:,.0f}\n- Moderado (4-8%/mes): ${c*0.04:,.0f} - ${c*0.08:,.0f}\n- Agresivo (8-15%/mes): ${c*0.08:,.0f} - ${c*0.15:,.0f}\n(Estos rangos no son garantizados, son referencias de traders consistentes)"
        return build_structured_response(
            "No existe una ganancia fija garantizada. Lo que sí existe son rangos realistas según tu estrategia y disciplina.",
            f"Un trader consistente con perfil {risk_profile} suele buscar entre 2% y 15% mensual, pero esto no es lineal. Hay meses positivos y meses negativos, y la consistencia se mide en trimestres, no en días." + ranges,
            "enfocarte solo en la ganancia sin considerar cuánto puedes perder, lo que lleva a decisiones impulsivas y a no respetar el stop loss.",
            "Lo más recomendable es definir primero tu riesgo máximo por operación (1-2% de tu cuenta), construir un sistema con reglas claras y medir resultados en períodos de al menos 3 meses.",
            f"Si quieres, puedo simularte escenarios con {capital_str} según diferentes estrategias y niveles de riesgo."
        )

    # ── MODO DECISIÓN ─────────────────────────────────────────────────────────
    if intent == "DECISION" and not analysis:
        sym_detected = None
        for k, v in SYMBOL_MAP.items():
            if k in lower:
                sym_detected = v
                break
        if sym_detected:
            return build_structured_response(
                f"Buena pregunta. No puedo decirte con certeza si es el momento exacto para entrar en {sym_detected}, pero sí puedo darte el contexto técnico real.",
                f"Los mercados se mueven en ciclos y cualquier activo puede tener correcciones incluso dentro de tendencias alcistas. Lo importante no es el momento perfecto, sino tener un plan claro.",
                "entrar sin confirmación técnica y sin stop loss definido, lo que puede convertir una buena idea en una pérdida innecesaria.",
                f"Una forma más sólida: espera confirmación en el gráfico, define tu zona de entrada, coloca tu stop loss y no arriesgues más del 1-2% de tu cuenta en esta operación.",
                f"Si quieres, escribe 'analiza {sym_detected}' y te doy las zonas de entrada reales con MA20/50/200, RSI y soporte/resistencia."
            )
        else:
            return build_structured_response(
                "Buena pregunta. La decisión de comprar o vender depende de más variables que solo el precio actual.",
                f"Para un perfil {risk_profile}, lo más importante es tener un plan antes de ejecutar: saber en qué entras, por qué entras, cuándo sales con ganancia y cuándo sales con pérdida.",
                "tomar decisiones sin contexto, lo que suele llevar a entrar en el momento equivocado o salir antes de tiempo.",
                "Define el activo que te interesa, tu capital disponible y tu horizonte de tiempo. Con eso puedo darte un análisis más específico.",
                "¿Qué activo tienes en mente? Dímelo y te hago el análisis técnico completo con datos reales."
            )

    # ── MODO TÉCNICA ──────────────────────────────────────────────────────────
    if intent == "TECNICA" and not analysis:
        if "rsi" in lower:
            return build_structured_response(
                "El RSI (Relative Strength Index) es un indicador de momentum que mide la velocidad y magnitud de los movimientos de precio.",
                "Se mueve entre 0 y 100. Por encima de 70 indica sobrecompra (posible corrección), por debajo de 30 indica sobreventa (posible rebote). Sin embargo, en tendencias fuertes puede mantenerse en zonas extremas por mucho tiempo.",
                "usarlo de forma aislada sin confirmar con otros indicadores como medias móviles o volumen.",
                "Lo más efectivo es combinar RSI con soporte/resistencia: busca divergencias (precio sube pero RSI baja) como señal de debilidad, y confirma con la tendencia principal.",
                "Si quieres, dime qué activo analizas y te doy el RSI actual con contexto real."
            )
        if any(w in lower for w in ["stop loss", "stop-loss"]):
            return build_structured_response(
                "El stop loss debe colocarse donde tu análisis deja de tener sentido, no de forma aleatoria.",
                "En compras, se ubica por debajo del soporte más cercano. En ventas, por encima de la resistencia. La distancia al stop determina el tamaño de tu posición, no al revés.",
                "colocarlo demasiado ajustado (te saca por ruido del mercado) o demasiado lejos (la pérdida es demasiado grande).",
                f"Fórmula práctica: si arriesgas 1% de {capital_str}, y tu stop está a 5% del precio de entrada, tu posición máxima es 20% de tu capital.",
                "Si quieres, dime qué activo operas y te doy los niveles reales de soporte para colocar tu stop."
            )
        if any(w in lower for w in ["win rate", "winrate", "tasa de acierto"]):
            return build_structured_response(
                "El win rate por sí solo no determina si eres rentable. Lo que importa es la relación entre lo que ganas cuando aciertas y lo que pierdes cuando fallas.",
                "Un sistema con 40% de aciertos puede ser más rentable que uno con 70% si el ratio riesgo/beneficio es 1:3 vs 1:0.5. La fórmula es: (Win Rate × Ganancia Promedio) - (Loss Rate × Pérdida Promedio).",
                "confiarte solo en el porcentaje de aciertos sin analizar el ratio riesgo/beneficio real de tu sistema.",
                "Registra tus últimas 20-30 operaciones, calcula tu ganancia promedio y pérdida promedio, y aplica la fórmula. Si el resultado es positivo, tu sistema es rentable.",
                "Si quieres, dime tu win rate y tu ratio R:R y te calculo si tu sistema es matemáticamente rentable."
            )
        return build_structured_response(
            "Buena pregunta técnica. Los indicadores son herramientas, no señales mágicas.",
            "Cada indicador tiene su contexto de uso. Las medias móviles funcionan mejor en tendencias, el RSI en rangos, el MACD para confirmar momentum. Ninguno funciona bien en todos los mercados.",
            "depender de un solo indicador sin entender el contexto del mercado.",
            "Lo más efectivo es combinar 2-3 indicadores complementarios y siempre confirmar con el contexto general del mercado.",
            "Si quieres, dime qué indicador específico te interesa y te explico cómo usarlo correctamente."
        )

    # ── ESG ───────────────────────────────────────────────────────────────────
    esg_words = ["esg", "sostenible", "sustentable", "verde", "limpia", "renovable", "carbono", "solar", "viento", "agua", "green", "clean"]
    if any(w in lower for w in esg_words) and not analysis:
        esg = {
            "conservative": "Para perfil conservador, los mejores ETFs ESG son:\n- ESGV: amplio mercado USA sostenible, baja volatilidad\n- ESGU: grandes empresas con criterios ESG\n- CRBN: enfocado en baja huella de carbono\n\nPide 'analiza ESGV' para ver señales de entrada.",
            "moderate": "Para perfil moderado, los mejores ETFs ESG son:\n- ESGU: núcleo sostenible USA\n- ICLN: energía limpia global con potencial de crecimiento\n- PHO: sector agua, defensivo y sostenible\n\nPide 'analiza ICLN' para ver señales técnicas.",
            "aggressive": "Para perfil agresivo, los mejores ETFs ESG son:\n- ICLN: energía limpia, alto potencial\n- TAN: energía solar, sector de alto crecimiento\n- FAN: energía eólica global\n\nPide 'analiza TAN' para ver señales de entrada.",
        }
        return esg.get(risk_level or "moderate", esg["moderate"])

    # ── MACRO ─────────────────────────────────────────────────────────────────
    macro_words = ["mercado", "hoy", "situacion", "mundial", "macro", "dolar", "petroleo", "fed", "banxico", "inflaci"]
    if any(w in lower for w in macro_words) and not analysis:
        macro = get_macro()
        mq = macro["quotes"]
        cb = macro["centralBanks"]
        fq = lambda q, pre="": f"{pre}{q['price']:.2f} ({'+' if q['changePct']>=0 else ''}{q['changePct']:.2f}% hoy)" if q else "N/D"
        trend = lambda q: "subiendo" if q and q["changePct"] >= 0 else "bajando"
        lines = [
            "Situacion del mercado global - datos en tiempo real:",
            "",
            "Dolar (DXY): " + fq(mq.get("dxy")),
            "Petroleo WTI: $" + fq(mq.get("wti")),
            "Bono USA 10Y: " + (f"{mq['usBond']['price']:.3f}% yield ({trend(mq.get('usBond'))})" if mq.get("usBond") else "N/D"),
            "USD/MXN: " + fq(mq.get("mxnusd")),
            "Oro: $" + fq(mq.get("gold")),
            "Bolsa Mexico (IPC): " + (f"{mq['bmv']['price']:.0f} pts ({trend(mq.get('bmv'))})" if mq.get("bmv") else "N/D"),
            f"Tasa Fed: {cb['fed']['rate']}%",
            f"Tasa Banxico: {cb['banxico']['rate']}%",
            "",
            "Mercados principales:",
            "S&P 500 (SPY): " + fmt_q(pm.get("SPY")),
            "Nasdaq (QQQ): " + fmt_q(pm.get("QQQ")),
            "Bitcoin: " + fmt_q(pm.get("BTC-USD")),
            "",
            "Pide 'analiza BTC' o cualquier activo para senales tecnicas con MA20/50/200 y RSI.",
        ]
        return "\n".join(lines)

    # ── ANÁLISIS TÉCNICO ──────────────────────────────────────────────────────
    if analysis:
        a = analysis
        q = pm.get(a["symbol"])
        signal_emoji = {"COMPRAR": "COMPRAR", "VENDER": "VENDER", "ACUMULAR": "ACUMULAR", "ESPERAR": "ESPERAR"}
        r = f"Analisis tecnico de {a['symbol']}\n"
        r += f"Precio: ${a['price']:.2f}"
        if q:
            r += f" ({'+' if q['changePct']>=0 else ''}{q['changePct']:.2f}% hoy)"
        r += "\n\nMedias Moviles:\n"
        if a.get("ma20"):
            r += f"- MA20:  ${a['ma20']:.2f}  {'precio arriba' if a['price'] > a['ma20'] else 'precio abajo'}\n"
        if a.get("ma50"):
            r += f"- MA50:  ${a['ma50']:.2f}  {'precio arriba' if a['price'] > a['ma50'] else 'precio abajo'}\n"
        if a.get("ma200"):
            r += f"- MA200: ${a['ma200']:.2f} {'precio arriba' if a['price'] > a['ma200'] else 'precio abajo'}\n"
        if a.get("rsi"):
            rsi_label = "Sobreventa - posible rebote" if a["rsi"] < 30 else "Sobrecompra - posible correccion" if a["rsi"] > 70 else "Zona neutral"
            r += f"- RSI(14): {a['rsi']:.1f} ({rsi_label})\n"
        r += f"\nSenal: {signal_emoji.get(a['overallSignal'], a['overallSignal'])}\n"
        if a.get("entryZone"):
            r += f"\nZona de entrada: ${a['entryZone']['low']:.2f} - ${a['entryZone']['high']:.2f}\n"
        if a.get("stopLoss"):
            r += f"Stop Loss: ${a['stopLoss']:.2f}\n"
        if a.get("target1"):
            r += f"Target 1: ${a['target1']:.2f}\n"
        if a.get("target2"):
            r += f"Target 2: ${a['target2']:.2f}\n"
        if a.get("support"):
            r += f"\nSoporte: {' | '.join(['$'+str(s) for s in a['support'][:2]])}\n"
        if a.get("resistance"):
            r += f"Resistencia: {' | '.join(['$'+str(s) for s in a['resistance'][:2]])}\n"
        risk_notes = {
            "conservative": "\nPerfil conservador: usa stop loss ajustado y posicion pequena (max 1-2% de tu cuenta).",
            "aggressive": "\nPerfil agresivo: puedes aprovechar la senal, pero respeta siempre el stop loss.",
            "moderate": "\nPerfil moderado: gestiona bien el riesgo, no arriesgues mas del 1-2% por operacion.",
        }
        r += risk_notes.get(risk_level or "moderate", "")
        return r

    # ── DEFAULT ───────────────────────────────────────────────────────────────
    defaults = {
        "conservative": f"Perfil Conservador: SPY {fmt_q(pm.get('SPY'))}, BND {fmt_q(pm.get('BND'))}. Pide 'analiza SPY' para senales tecnicas.",
        "moderate": f"Perfil Moderado: SPY {fmt_q(pm.get('SPY'))}, QQQ {fmt_q(pm.get('QQQ'))}. Pide 'analiza QQQ' para senales tecnicas.",
        "aggressive": f"Perfil Agresivo: QQQ {fmt_q(pm.get('QQQ'))}, BTC {fmt_q(pm.get('BTC-USD'))}, NVDA {fmt_q(pm.get('NVDA'))}. Pide 'analiza NVDA' para senales.",
    }
    return defaults.get(risk_level or "moderate", "Puedo analizar cualquier activo con MA20/50/200, RSI y zonas de entrada. Tambien puedo responder preguntas sobre estrategia, riesgo y gestion de capital. Prueba: 'analiza BTC' o 'como esta el mercado'")


@app.route("/api/market")
def market():
    symbols = request.args.get("symbols", "SPY,QQQ,BTC-USD,ETH-USD,GLD,BND,AAPL,MSFT,NVDA,AMZN").split(",")
    quotes = get_multiple_quotes(symbols)
    return jsonify({"quotes": quotes, "timestamp": datetime.utcnow().isoformat()})


@app.route("/api/quote/<symbol>")
def quote(symbol):
    q = get_quote(symbol.upper())
    if not q:
        return jsonify({"error": "Symbol not found"}), 404
    return jsonify(q)


@app.route("/api/analysis/<symbol>")
def analysis(symbol):
    a = get_full_analysis(symbol.upper())
    if not a:
        return jsonify({"error": "Could not analyze"}), 404
    return jsonify(a)


@app.route("/api/news/<symbol>")
def news(symbol):
    n = get_news(symbol.upper())
    return jsonify({"news": n})


@app.route("/api/macro")
def macro():
    return jsonify(get_macro())


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "")
    risk_level = data.get("riskLevel")
    market_symbols = ["SPY", "QQQ", "BTC-USD", "ETH-USD", "GLD", "BND", "AAPL", "MSFT", "NVDA"]
    quotes = get_multiple_quotes(market_symbols)
    # Check intent first - don't run symbol analysis for non-analysis intents
    intent = detect_intent(message.lower())
    sym = None
    analysis_data = None
    news_data = []
    # Only detect symbol and run analysis for DECISION, GENERAL, or TECNICA intents
    if intent in ("DECISION", "GENERAL", "TECNICA") or any(w in message.lower() for w in ["analiza", "analizar", "señal", "senal", "precio de", "como esta"]):
        sym = detect_symbol(message)
        if sym:
            analysis_data = get_full_analysis(sym)
            news_data = get_news(sym)
    response = build_chat_response(message, risk_level, quotes, analysis_data, news_data)
    return jsonify({
        "response": response,
        "model": "python-yfinance",
        "marketData": quotes,
        "analysis": analysis_data,
        "news": news_data,
    })


@app.route("/api/invest", methods=["POST"])
def invest():
    data = request.get_json() or {}
    risk_level = data.get("riskLevel", "moderate")
    capital = float(data.get("capital", 1000))
    profile = PORTFOLIOS.get(risk_level, PORTFOLIOS["moderate"])
    symbols = [a["symbol"] for a in profile if a["symbol"] != "CASH"]
    quotes = get_multiple_quotes(symbols)
    pm = {q["symbol"]: q for q in quotes}
    assets = []
    for asset in profile:
        amount = round(capital * asset["pct"] / 100, 2)
        q = pm.get(asset["symbol"])
        price = q["price"] if q else None
        shares = round(amount / price, 4) if price else None
        assets.append({**asset, "amount": amount, "price": price, "shares": shares, "changePct": round(q["changePct"], 2) if q else None})
    return jsonify({"assets": assets, "capital": capital, "riskLevel": risk_level})


@app.route("/api/status")
def status():
    return jsonify({"status": "ok", "engine": "python-yfinance", "timestamp": datetime.utcnow().isoformat()})


if __name__ == "__main__":
    ip = get_local_ip()
    print(f"\n{'='*50}")
    print(f"  BLACK.IA Python Server (yfinance)")
    print(f"  Local:   http://localhost:3001")
    print(f"  Network: http://{ip}:3001")
    print(f"{'='*50}\n")
    app.run(host="0.0.0.0", port=3001, debug=False)
