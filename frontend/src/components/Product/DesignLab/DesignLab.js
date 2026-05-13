import React, { useEffect, useRef, useState } from 'react';
import { Canvas, FabricImage, IText, loadSVGFromString, util } from 'fabric';
import { useLocation } from 'react-router-dom';
import { 
  Type, 
  Trash2, 
  Download, 
  Sparkles, 
  Shapes, 
  Layers, 
  RotateCcw,
  Plus
} from 'lucide-react';
import { SHAPES } from './shapeLibrary';
import "./DesignLab.css";

const DesignLab = ({ generatedAiImage: propGeneratedAiImage }) => {
  const location = useLocation();
  const generatedAiImage = propGeneratedAiImage || (location.state && location.state.generatedImage) || null;

  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);

  // 1. Initialize the empty canvas on load
  useEffect(() => {
    const canvas = new Canvas(canvasRef.current, {
      width: 250, 
      height: 350,
      backgroundColor: 'transparent',
    });
    setFabricCanvas(canvas);
    return () => canvas.dispose();
  }, []);

  // 2. Automatically add the AI image to the canvas
  useEffect(() => {
    if (fabricCanvas && generatedAiImage) {
      FabricImage.fromURL(generatedAiImage).then((img) => {
        img.scaleToWidth(150);
        fabricCanvas.add(img);
        fabricCanvas.centerObject(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      }).catch(err => {
        console.error("Error loading image into fabric:", err);
      });
    }
  }, [generatedAiImage, fabricCanvas]);

  // 3. Add custom text
  const addText = () => {
    if (!fabricCanvas) return;
    const text = new IText('Double click to edit', {
      left: 50,
      top: 50,
      fontFamily: 'Inter',
      fill: '#000000',
      fontSize: 24,
      fontWeight: 'bold'
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
  };

  // 4. Delete selected object
  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }
  };

  // 5. Clear all
  const clearAll = () => {
    if (!fabricCanvas) return;
    if (window.confirm("Are you sure you want to clear your entire design?")) {
      fabricCanvas.clear();
      fabricCanvas.renderAll();
    }
  };

  // 6. Add SVG shape
  const addSvgShape = (svgString) => {
    if (!fabricCanvas) return;

    loadSVGFromString(svgString).then(({ objects, options }) => {
      const shape = util.groupSVGElements(objects, options);
      shape.scaleToWidth(80);
      shape.set({ 
        fill: '#000000', 
        left: 85, 
        top: 85 
      });
      fabricCanvas.add(shape);
      fabricCanvas.setActiveObject(shape);
      fabricCanvas.renderAll();
    }).catch(err => {
      console.error("Error loading SVG string:", err);
    });
  };

  const exportDesign = () => {
    if(fabricCanvas) {
      const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 4 });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `custom-design-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="design-lab-container">
      <div className="design-lab-bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="design-lab-content">
        <div className="ai-badge">
          <Sparkles size={16} /> <span>Creative Design Lab</span>
        </div>
        
        <h1 className="design-lab-title">Craft Your <br /><span className="text-gradient">Signature Style</span></h1>
        <p className="design-lab-subtitle">
          Bring your ideas to life with our professional design tools. 
          Combine AI-generated art, custom text, and geometric elements.
        </p>

        <div className="design-layout">
          {/* Tools Sidebar */}
          <aside className="design-tools-sidebar">
            <div className="tool-card">
              <h3><Plus size={18} /> Add Elements</h3>
              <div className="action-grid">
                <button onClick={addText} className="lab-btn btn-primary">
                  <Type size={18} /> Text
                </button>
                <button onClick={deleteSelected} className="lab-btn btn-danger">
                  <Trash2 size={18} /> Delete
                </button>
              </div>
            </div>

            <div className="tool-card">
              <h3><Shapes size={18} /> Artwork Library</h3>
              <div className="shape-grid">
                {SHAPES.map((shape) => (
                  <button 
                    key={shape.id} 
                    onClick={() => addSvgShape(shape.svg)}
                    className="shape-btn"
                    title={`Add ${shape.name}`}
                  >
                    <div 
                       className="shape-icon-wrapper"
                       dangerouslySetInnerHTML={{ __html: shape.svg }} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="tool-card">
              <h3><Layers size={18} /> Workspace</h3>
              <button onClick={clearAll} className="lab-btn btn-secondary">
                <RotateCcw size={18} /> Reset Canvas
              </button>
            </div>
          </aside>

          {/* Main Mockup Area */}
          <main className="tshirt-mockup-section">
            <div className="tshirt-mockup-container">
          <div className="tshirt-base" style={{ backgroundImage: "url('/images/white-tshirt-base.png')" }}></div>
              <div className="canvas-boundary">
                <canvas ref={canvasRef} />
              </div>
            </div>
          </main>
        </div>

        <div className="export-section">
          <button className="lab-btn btn-primary export-btn" onClick={exportDesign}>
            <Download size={20} /> Finish & Export Design
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignLab;
