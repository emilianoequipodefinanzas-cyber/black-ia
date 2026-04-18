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

def build_chat_response(message, risk_level, quotes, analysis, news):
    lower = message.lower()
    pm = {q["symbol"]: q for q in quotes}

    # ── Respuestas profesionales contextuales ──────────────────────────────────

    def professional_response(text, suffix=""):
        return text + ("\n\n" + suffix if suffix else "")

    # Escenario: buen momento para comprar (sin activo específico)
    buy_moment = ["buen momento", "momento para comprar", "debo comprar ahora", "es momento", "cuando comprar", "cuándo comprar", "entrar ahora", "deberia invertir", "debería invertir", "debo invertir"]
    if any(w in lower for w in buy_moment) and not analysis:
        sym_hint = ""
        for k, v in SYMBOL_MAP.items():
            if k in lower:
                sym_hint = f" Si quieres, dime tu capital y te hago el análisis técnico de {v} con zonas de entrada reales."
                break
        return professional_response(
            "Buena pregunta. Depende más del contexto que del momento exacto.\n\n"
            "Lo importante es entender por qué quieres entrar: si es por tendencia, por inversión a largo plazo o por especulación. "
            "Los mercados se mueven en ciclos, así que incluso en tendencias alcistas puede haber caídas temporales fuertes.\n\n"
            "El riesgo principal es entrar sin un plan y terminar vendiendo en pérdida por movimientos normales del mercado.\n\n"
            "Una forma más sólida de abordarlo sería definir un punto de entrada, un nivel de salida (stop loss) y considerar entrar en partes en lugar de todo de una sola vez.",
            f"Si quieres, dime tu capital y horizonte de inversión y te ayudo a ajustarlo mejor.{sym_hint}"
        )

    # Escenario: cuánto puedo ganar
    gain_words = ["cuanto puedo ganar", "cuánto puedo ganar", "cuanto gano", "cuánto gano", "ganancias posibles", "rendimiento esperado", "cuanto me da", "cuánto me da"]
    if any(w in lower for w in gain_words) and not analysis:
        capital_hint = ""
        import re as _re
        m = _re.search(r'\$?\s*(\d[\d,\.]*)', message)
        if m:
            capital_hint = f" Con ${m.group(1)}, un rendimiento mensual del 3% serían ~${float(m.group(1).replace(',',''))*0.03:,.0f} y del 10% serían ~${float(m.group(1).replace(',',''))*0.10:,.0f}, pero esto no es lineal ni garantizado."
        return professional_response(
            "No hay una ganancia fija garantizada, ya que depende de tu estrategia, tu disciplina y las condiciones del mercado.\n\n"
            "Un trader consistente suele buscar rendimientos entre un 2% y 10% mensual, pero esto no es lineal ni seguro.\n\n"
            "El principal riesgo es enfocarte solo en la ganancia sin considerar cuánto puedes perder, lo que suele llevar a decisiones impulsivas.\n\n"
            "Lo más recomendable es enfocarte primero en proteger tu capital, usar una buena gestión de riesgo (arriesgar máximo 1-2% por operación) y construir consistencia antes de escalar.",
            f"Si quieres, puedo simularte escenarios realistas con ese capital.{capital_hint}"
        )

    # Escenario: perdí dinero
    loss_words = ["perdi dinero", "perdí dinero", "perdi en", "perdí en", "tuve perdidas", "tuve pérdidas", "estoy en perdida", "estoy en pérdida", "me fue mal"]
    if any(w in lower for w in loss_words) and not analysis:
        return professional_response(
            "Perder dinero es parte del proceso, incluso para traders con experiencia.\n\n"
            "Lo importante es entender por qué ocurrió: si seguiste tu estrategia o si fue una decisión emocional.\n\n"
            "El mayor riesgo ahora no es la pérdida en sí, sino intentar recuperarla rápido, lo que suele llevar a errores más grandes.\n\n"
            "Una mejor opción sería pausar un momento, revisar tus operaciones y detectar si hubo fallas en disciplina o en tu sistema.",
            "Si quieres, puedo ayudarte a analizar qué pudo haber pasado y cómo evitarlo en el futuro."
        )

    # Escenario: stop loss
    sl_words = ["stop loss", "donde poner stop", "dónde poner stop", "nivel de stop", "donde va el stop", "dónde va el stop", "como poner stop", "cómo poner stop"]
    if any(w in lower for w in sl_words) and not analysis:
        return professional_response(
            "El stop loss debe colocarse en un punto donde tu análisis deja de tener sentido, no de forma aleatoria.\n\n"
            "Normalmente se ubica por debajo de soportes clave en compras, o por encima de resistencias en ventas.\n\n"
            "El riesgo de no usarlo correctamente es terminar con pérdidas grandes que afectan seriamente tu cuenta.\n\n"
            "Una forma práctica: define primero cuánto estás dispuesto a perder (por ejemplo, 1% de tu cuenta) y ajusta el tamaño de posición en función de eso.",
            "Si quieres, dime qué activo estás operando y te doy un ejemplo con niveles reales de soporte y resistencia."
        )

    # Escenario: mejor activo
    best_asset = ["mejor activo", "que activo", "qué activo", "en que invertir", "en qué invertir", "que comprar", "qué comprar", "que es mejor", "qué es mejor", "cual es mejor", "cuál es mejor"]
    if any(w in lower for w in best_asset) and not analysis:
        risk_context = {
            "conservative": "Para un perfil conservador, los índices como SPY o ETFs de bonos como BND suelen ser más estables.",
            "moderate": "Para un perfil moderado, una combinación de SPY, QQQ y algo de BTC puede dar buen equilibrio.",
            "aggressive": "Para un perfil agresivo, activos como QQQ, NVDA, BTC o ETH tienen mayor potencial pero también mayor volatilidad.",
        }
        hint = risk_context.get(risk_level or "moderate", "")
        return professional_response(
            "No existe un mejor activo universal, todo depende de tu perfil de riesgo y tus objetivos.\n\n"
            "Por ejemplo, los índices suelen ser más estables, mientras que las criptomonedas son más volátiles pero con mayor potencial de retorno.\n\n"
            f"{hint}\n\n"
            "El riesgo es elegir un activo solo por moda o por lo que otros dicen, sin entenderlo realmente.",
            "Si quieres, puedo ayudarte a definir cuál se ajusta mejor a ti. Dime tu capital y horizonte de inversión."
        )

    # Escenario: duplicar dinero rápido
    double_words = ["duplicar", "doblar", "x2", "x10", "multiplicar", "rapido", "rápido", "en poco tiempo", "overnight", "de la noche"]
    if any(w in lower for w in double_words) and not analysis:
        return professional_response(
            "Duplicar el dinero rápidamente implica asumir un nivel de riesgo muy alto.\n\n"
            "En la práctica, estrategias que prometen resultados rápidos suelen terminar en pérdidas igual de rápidas. "
            "El mercado no regala dinero, y quien promete eso generalmente está vendiendo algo.\n\n"
            "El riesgo aquí es sobreapalancarte o tomar decisiones impulsivas buscando resultados inmediatos.\n\n"
            "Lo más sólido es buscar crecimiento progresivo, enfocándote en consistencia y protección del capital.",
            "Si quieres, puedo ayudarte a plantear un plan realista para crecer tu cuenta de forma sostenible."
        )

    # Escenario: win rate / rentabilidad
    winrate_words = ["win rate", "winrate", "tasa de acierto", "porcentaje de acierto", "soy rentable", "sistema rentable", "estrategia rentable"]
    if any(w in lower for w in winrate_words) and not analysis:
        return professional_response(
            "El win rate por sí solo no determina si eres rentable.\n\n"
            "Lo importante es cuánto ganas cuando aciertas frente a cuánto pierdes cuando fallas. "
            "Un sistema con 40% de aciertos puede ser más rentable que uno con 70% si el ratio riesgo/beneficio es mejor.\n\n"
            "El riesgo es confiarse solo en el porcentaje sin analizar la relación riesgo/beneficio real.\n\n"
            "Una forma más completa de evaluarlo: multiplica tu win rate por tu ganancia promedio y réstale el resultado de multiplicar tu loss rate por tu pérdida promedio.",
            "Si quieres, puedo ayudarte a calcular si tu sistema es rentable con tus datos reales."
        )

    # Escenario: crypto segura / riesgo crypto
    crypto_safe = ["seguro invertir en crypto", "seguro en crypto", "es seguro bitcoin", "riesgo de crypto", "riesgo en cripto", "crypto es seguro", "cripto es seguro"]
    if any(w in lower for w in crypto_safe) and not analysis:
        return professional_response(
            "No es completamente seguro, ya que es un mercado muy volátil.\n\n"
            "Las criptomonedas pueden generar grandes oportunidades, pero también caídas del 50-80% en poco tiempo. "
            "Eso no significa que sea malo, sino que requiere una gestión de riesgo más estricta.\n\n"
            "El riesgo principal es la volatilidad extrema y, en algunos casos, la falta de regulación.\n\n"
            "Para reducir riesgos: diversifica, no inviertas más de lo que puedes perder, usa plataformas confiables y define tu stop loss antes de entrar.",
            "Si quieres, puedo ayudarte a estructurar una inversión más segura en crypto según tu perfil."
        )

    # Escenario: mercado cayendo / qué hago
    market_down = ["mercado cae", "mercado esta cayendo", "mercado está cayendo", "todo cae", "todo baja", "que hago si cae", "qué hago si cae", "mercado en rojo", "bolsa cae", "crash"]
    if any(w in lower for w in market_down) and not analysis:
        return professional_response(
            "Las caídas son normales en cualquier mercado, incluso en tendencias alcistas de largo plazo.\n\n"
            "La decisión depende de tu enfoque: si eres trader, deberías tener stops definidos y respetarlos; "
            "si eres inversionista de largo plazo, una caída puede ser una oportunidad de comprar más barato.\n\n"
            "El riesgo más grande es reaccionar impulsivamente y vender en pánico, cristalizando pérdidas que podrían haberse recuperado.\n\n"
            "Lo más recomendable es seguir tu plan y no tomar decisiones basadas en emociones del momento.",
            "Si quieres, dime qué activo tienes y vemos las opciones con datos reales."
        )

    # Escenario: debo invertir ahora / universal
    should_invest = ["debo invertir", "debería invertir", "vale la pena invertir", "conviene invertir", "es buena idea invertir", "me recomiendas invertir"]
    if any(w in lower for w in should_invest) and not analysis:
        return professional_response(
            "Buena pregunta. La respuesta depende de tu objetivo, tu tolerancia al riesgo y el contexto del mercado.\n\n"
            "En términos generales, invertir puede ser una buena decisión si tienes un plan claro y entiendes en qué estás entrando. "
            "Sin embargo, todos los mercados tienen riesgo y no hay garantías de ganancia.\n\n"
            "Una forma más sólida de hacerlo es definir cuánto invertir, en qué activo y bajo qué estrategia antes de ejecutar.",
            "Si quieres, puedo ayudarte a estructurarlo según tu situación. Dime tu capital y perfil de riesgo."
        )

    # ── ESG ────────────────────────────────────────────────────────────────────
    esg_words = ["esg", "sostenible", "sustentable", "verde", "limpia", "renovable", "carbono", "solar", "viento", "agua", "green", "clean"]
    if any(w in lower for w in esg_words) and not analysis:
        esg = {
            "conservative": "Perfil Conservador:\n- ESGV: diversificado y estable\n- ESGU: grandes empresas sostenibles\n- CRBN: baja huella de carbono\n\nPide 'analiza ESGV' para senales.",
            "moderate": "Perfil Moderado:\n- ESGU: nucleo sostenible USA\n- ICLN: energia limpia con crecimiento\n- PHO: sector agua\n\nPide 'analiza ICLN' para senales.",
            "aggressive": "Perfil Agresivo:\n- ICLN: alto potencial\n- TAN: energia solar\n- FAN: energia eolica\n\nPide 'analiza TAN' para senales.",
        }
        return esg.get(risk_level or "moderate", esg["moderate"])
    macro_words = ["mercado", "hoy", "situacion", "mundial", "macro", "dolar", "petroleo", "fed", "banxico", "inflaci"]
    if any(w in lower for w in macro_words) and not analysis:
        macro = get_macro()
        mq = macro["quotes"]
        cb = macro["centralBanks"]
        fq = lambda q, pre="": f"{pre}{q['price']:.2f} ({'+' if q['changePct']>=0 else ''}{q['changePct']:.2f}% hoy)" if q else "N/D"
        trend = lambda q: "subiendo" if q and q["changePct"] >= 0 else "bajando"
        lines = [
            "Situacion del mercado global - datos en tiempo real (yfinance):",
            "",
            "Dolar (DXY): " + fq(mq.get('dxy')),
            "Petroleo WTI: " + fq(mq.get('wti'), '$'),
            "Bono USA 10Y: " + (f"{mq['usBond']['price']:.3f}% yield ({trend(mq.get('usBond'))})" if mq.get('usBond') else "N/D"),
            "USD/MXN: " + fq(mq.get('mxnusd')),
            "Oro: " + fq(mq.get('gold'), '$'),
            "Bolsa Mexico (IPC): " + (f"{mq['bmv']['price']:.0f} pts ({trend(mq.get('bmv'))})" if mq.get('bmv') else "N/D"),
            f"Tasa Fed: {cb['fed']['rate']}%",
            f"Tasa Banxico: {cb['banxico']['rate']}%",
            "",
            "Mercados principales:",
            "S&P 500 (SPY): " + fmt_q(pm.get('SPY')),
            "Nasdaq (QQQ): " + fmt_q(pm.get('QQQ')),
            "Bitcoin: " + fmt_q(pm.get('BTC-USD')),
            "",
            "Pide 'analiza BTC' o cualquier activo para senales tecnicas.",
        ]
        return "\n".join(lines)
    if analysis:
        a = analysis
        signal_labels = {"COMPRAR": "COMPRAR", "VENDER": "VENDER", "ACUMULAR": "ACUMULAR", "ESPERAR": "ESPERAR"}
        q = pm.get(a["symbol"])
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
            rsi_label = 'Sobreventa' if a['rsi'] < 30 else 'Sobrecompra' if a['rsi'] > 70 else 'Normal'
            r += f"- RSI(14): {a['rsi']:.1f} ({rsi_label})\n"
        r += f"\nSenal: {signal_labels.get(a['overallSignal'], a['overallSignal'])}\n"
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
            "conservative": "\nPerfil conservador: usa stop loss ajustado y posicion pequena.",
            "aggressive": "\nPerfil agresivo: puedes aprovechar la senal con mayor posicion.",
            "moderate": "\nPerfil moderado: gestiona bien el riesgo con stop loss.",
        }
        r += risk_notes.get(risk_level or "moderate", "")
        return r
    defaults = {
        "conservative": f"Perfil Conservador: SPY {fmt_q(pm.get('SPY'))}, BND {fmt_q(pm.get('BND'))}. Pide 'analiza SPY' para senales.",
        "moderate": f"Perfil Moderado: SPY {fmt_q(pm.get('SPY'))}, QQQ {fmt_q(pm.get('QQQ'))}. Pide 'analiza QQQ' para senales.",
        "aggressive": f"Perfil Agresivo: QQQ {fmt_q(pm.get('QQQ'))}, BTC {fmt_q(pm.get('BTC-USD'))}, NVDA {fmt_q(pm.get('NVDA'))}. Pide 'analiza NVDA'.",
    }
    return defaults.get(risk_level or "moderate", "Puedo analizar cualquier activo. Prueba: 'analiza BTC' o 'como esta el mercado'")


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
    sym = detect_symbol(message)
    analysis_data = None
    news_data = []
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
