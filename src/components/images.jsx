import { useState, useEffect } from 'react';
import './images.css';

export default function ImagesPage({ onNavBack }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load local images from the Images folder
    try {
      const importAll = (r) => {
        return r.keys().map((item, index) => ({
          id: index,
          name: item.replace('./', ''),
          url: r(item)
        }));
      };
      
      const localImages = importAll(require.context('./Images', false, /\.(png|jpe?g|svg)$/i));
      setImages(localImages);
    } catch (err) {
      console.error('Failed to load local images', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="images-app">
      <header className="answer-top answer-top-fixed">
        <h1 className='code-sin'>Images Gallery</h1>
        <button type="button" className="btn-ghost" onClick={onNavBack}>
          &larr; Back to Answer Sheet
        </button>
      </header>

      <div className="images-body">
        <div className="images-list-section">
          <h2 className="images-list-title">Local Images Directory</h2>
          {loading ? (
            <p>Loading images...</p>
          ) : images.length === 0 ? (
            <p className="empty">No images found in the Images folder.</p>
          ) : (
            <div className="images-grid">
              {images.map((img) => (
                <div key={img.id} className="image-card">
                  <div className="image-card-header">
                    <span>{img.name}</span>
                  </div>
                  <img src={img.url} alt={img.name} className="image-display" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
