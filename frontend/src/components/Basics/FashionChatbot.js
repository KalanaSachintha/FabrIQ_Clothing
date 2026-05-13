import React, { useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CartContext } from "../Order/Customer/CartContext";
import "./FashionChatbot.css";

// Match backend API base from AuthContext
const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api";
const ORIGIN = API_BASE.replace(/\/api$/, "");

const isAddToCartCommand = (text = "") => {
  const lower = text.toLowerCase();
  return /add (this|it|to (my )?cart)/i.test(lower) || /add to cart/i.test(lower);
};

export default function FashionChatbot() {
  const { user } = useAuth();
  const { addToCart } = useContext(CartContext);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi! I’m your fashion assistant. Ask me things like ‘Show me red hoodies’ or ‘What size should I get for a hoodie?’.",
    },
  ]);

  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);

  const sendMessage = async (overrideText) => {
    const candidate = overrideText ?? input;
    const text = typeof candidate === "string" ? candidate.trim() : "";
    if (!text || loading) return;

    // Handle special "add to cart" voice/text commands locally
    if (isAddToCartCommand(text)) {
      const lastBotWithProducts = [...messages]
        .reverse()
        .find((m) => m.from === "bot" && Array.isArray(m.products) && m.products.length);

      if (!lastBotWithProducts) {
        setMessages((prev) => [
          ...prev,
          { from: "user", text },
          {
            from: "bot",
            text:
              "I don't see a product to add yet. Ask me to find something first, then say 'add to cart'.",
          },
        ]);
        return;
      }

      const target = lastBotWithProducts.products[0];
      try {
        const res = await fetch(`${ORIGIN}/products/${target.id}`);
        const full = await res.json().catch(() => null);
        const product = full && full._id ? full : {
          _id: target.id,
          productId: target.id,
          name: target.name,
          price: target.price,
          imageUrl: target.imageUrl,
          brand: target.brand,
        };

        addToCart({ ...product, productId: product._id || product.productId || target.id });

        setMessages((prev) => [
          ...prev,
          { from: "user", text },
          {
            from: "bot",
            text: `Got it – I've added ${target.name} to your cart.`,
          },
        ]);
      } catch (err) {
        console.error("Voice add-to-cart failed", err);
        setMessages((prev) => [
          ...prev,
          { from: "user", text },
          {
            from: "bot",
            text:
              "I couldn't add that to your cart just now. Please try again or use the Add to cart button.",
          },
        ]);
      }
      return;
    }

    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId: user?._id || null }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      const replyText = data.message || "I’m not sure I understood that, could you rephrase?";
      const products = Array.isArray(data.products) ? data.products : [];

      setMessages((prev) => [
        ...prev,
        { from: "bot", text: replyText, products },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text:
            "Sorry, I couldn’t process that just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- Voice command setup (Web Speech API) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) {
          finalTranscript += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      if (interim) setInterimTranscript(interim.trim());
      if (finalTranscript) {
        const spoken = finalTranscript.trim();
        setInterimTranscript("");
        setInput(spoken);
        // Automatically send recognized command as a chat message
        sendMessage(spoken);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    setSupportsSpeech(true);

    return () => {
      recognition.stop();
    };
  }, []);

  const toggleListening = () => {
    if (!supportsSpeech || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInterimTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="fashion-chatbot">
      <button
        className="fashion-chatbot-toggle"
        onClick={() => setIsOpen((o) => !o)}
      >
        {isOpen ? "×" : "Ask Stylist"}
      </button>

      {isOpen && (
        <div className="fashion-chatbot-panel">
          <div className="fashion-chatbot-messages">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`fashion-chatbot-message fashion-chatbot-message--${m.from}`}
              >
                <div className="fashion-chatbot-bubble">
                  <p>{m.text}</p>
                  {Array.isArray(m.products) && m.products.length > 0 && (
                    <div className="fashion-chatbot-products">
                      {m.products.map((p) => (
                        <a
                          key={p.id}
                          href={`/product/${p.id}`}
                          className="fashion-chatbot-product-card"
                        >
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.name} />
                          )}
                          <div className="fashion-chatbot-product-info">
                            <span className="fashion-chatbot-product-name">{p.name}</span>
                            {p.brand && (
                              <span className="fashion-chatbot-product-brand">{p.brand}</span>
                            )}
                            {typeof p.price === "number" && (
                              <span className="fashion-chatbot-product-price">
                                Rs. {p.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="fashion-chatbot-message fashion-chatbot-message--bot">
                <div className="fashion-chatbot-bubble">
                  <p>Thinking of outfits for you…</p>
                </div>
              </div>
            )}
            {isListening && (
              <div className="fashion-chatbot-message fashion-chatbot-message--bot">
                <div className="fashion-chatbot-bubble fashion-chatbot-bubble--listening">
                  <p>
                    {interimTranscript ||
                      "Listening… try saying ‘Filter blue jackets’ or ‘Add to cart’."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="fashion-chatbot-input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about colors, styles, sizes…"
              rows={1}
            />
            <button
              type="button"
              onClick={toggleListening}
              disabled={!supportsSpeech || loading}
              className={`fashion-chatbot-mic ${
                isListening ? "fashion-chatbot-mic--active" : ""
              }`}
              title={
                supportsSpeech
                  ? isListening
                    ? "Stop listening"
                    : "Voice command"
                  : "Voice commands not supported in this browser"
              }
            >
              🎙
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="fashion-chatbot-send"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
