import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Sparkles, Download, RefreshCw, Layers, AlertCircle, User, UserCheck, Image as ImageIcon, RotateCcw, Edit3 } from "lucide-react";
import "./AIDesign.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const AIDesign = () => {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);
    const [modelType, setModelType] = useState("graphic"); // graphic, male, female, streetwear
    const [error, setError] = useState(false);
    const currentImageUrl = useRef(null);

    // Cleanup object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (currentImageUrl.current) {
                URL.revokeObjectURL(currentImageUrl.current);
            }
        };
    }, []);

    const handleGenerate = async (e) => {
        if (e) e.preventDefault();
        const userInput = prompt.trim();
        if (!userInput) return;

        setIsGenerating(true);
        setGeneratedImage(null);
        setStatusMsg("Consulting AI Design Studio...");
        setError(false);

        try {
            const res = await axios.post(`${API_ROOT}/api/ai/generate`, {
                userPrompt: userInput, // Using the input text or combining with model styles
            });
            
            setGeneratedImage(res.data.imageUrl);
            setStatusMsg(null);
            setError(false);
        } catch (err) {
            console.error("Error generating design:", err);
            setError(true);
            const backendMsg = err.response?.data?.message || err.response?.data?.detail;
            setStatusMsg(backendMsg ? `AI Error: ${backendMsg}` : "Error generating design. Please check your backend console!");
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadImage = async () => {
        if (!generatedImage) return;
        try {
            const response = await fetch(generatedImage);
            if (!response.ok) throw new Error("Network latency issues");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `fabriq-${modelType}-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            window.open(generatedImage, "_blank");
        }
    };

    return (
        <div className="ai-design-container">
            <div className="ai-design-bg-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
            </div>

            <div className="ai-design-content">
                <div className="ai-text-section">
                    <div className="ai-badge">
                        <Sparkles size={16} /> <span>AI Fashion Studio</span>
                    </div>
                    <h1 className="ai-title">Launch your brand with<br /><span className="text-gradient">AI Model Mockups</span></h1>
                    <p className="ai-subtitle">Transform designs into professional photography. Generate high-end clothing models wearing your custom creations in seconds.</p>

                    <div className="model-selector-container">
                        <h3>1. Select Your Presentation Style</h3>
                        <div className="model-grid">
                            <button
                                className={`model-card ${modelType === "graphic" ? "active" : ""}`}
                                onClick={() => setModelType("graphic")}
                            >
                                <ImageIcon size={20} />
                                <span>Graphic Only</span>
                            </button>
                            <button
                                className={`model-card ${modelType === "female" ? "active" : ""}`}
                                onClick={() => setModelType("female")}
                            >
                                <User size={20} />
                                <span>Female Model</span>
                            </button>
                            <button
                                className={`model-card ${modelType === "male" ? "active" : ""}`}
                                onClick={() => setModelType("male")}
                            >
                                <UserCheck size={20} />
                                <span>Male Model</span>
                            </button>
                            <button
                                className={`model-card ${modelType === "streetwear" ? "active" : ""}`}
                                onClick={() => setModelType("streetwear")}
                            >
                                <Layers size={20} />
                                <span>Streetwear</span>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleGenerate} className="ai-prompt-form">
                        <h3>2. Describe Your Design</h3>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                placeholder="E.g., A vintage 90s dragon design, cinematic gold..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isGenerating}
                                className="ai-input"
                            />
                            <button
                                type="submit"
                                className={`ai-generate-btn ${isGenerating ? "generating" : ""}`}
                                disabled={isGenerating || !prompt.trim()}
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw size={18} className="spin-anim" /> Generating...
                                    </>
                                ) : (
                                    <>
                                        Generate <Sparkles size={18} />
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="status-container">
                            {statusMsg && (
                                <div className={`ai-status-msg ${error ? "error" : "loading"}`}>
                                    {error ? <AlertCircle size={14} className="error-icon" /> : <RefreshCw size={14} className="spin-anim" />}
                                    <span>{statusMsg}</span>
                                    {!isGenerating && error && (
                                        <button type="button" onClick={() => handleGenerate()} className="retry-link">
                                            <RotateCcw size={12} /> Try again
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className={`ai-preview-section ${isGenerating ? "generating" : ""}`}>
                    <div className="ai-preview-card glass-panel">
                        <div className="preview-header">
                            <h3>Live Preview</h3>
                            <div className="preview-info">
                                <span>Model: {modelType.charAt(0).toUpperCase() + modelType.slice(1)}</span>
                            </div>
                        </div>

                        <div className="preview-canvas artwork-mode">
                            {isGenerating ? (
                                <div className="loading-state">
                                    <div className="scanning-line"></div>
                                    <Layers size={40} className="pulse-anim" />
                                    <p>AI Studio is Rendering...</p>
                                </div>
                            ) : generatedImage ? (
                                <div className="result-container">
                                    <img src={generatedImage} alt="Your AI Design" className="raw-design" />
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon-circle">
                                        <Sparkles size={32} />
                                    </div>
                                    <p>Select a model and describe your design to start</p>
                                </div>
                            )}
                        </div>

                        <div className="preview-actions">
                            <button
                                type="button"
                                className="action-btn outline-btn"
                                onClick={() => { setGeneratedImage(null); setPrompt(""); setStatusMsg(null); }}
                                disabled={isGenerating}
                            >
                                Clear All
                            </button>
                            <button
                                type="button"
                                className="action-btn primary-btn"
                                onClick={downloadImage}
                                disabled={!generatedImage || isGenerating}
                            >
                                <Download size={18} /> Export Mockup
                            </button>
                            {generatedImage && (
                                <button
                                    type="button"
                                    className="action-btn primary-btn"
                                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white' }}
                                    onClick={() => navigate("/design-lab", { state: { generatedImage } })}
                                >
                                    <Edit3 size={18} /> Design Lab
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIDesign;
