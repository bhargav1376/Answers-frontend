import { useState, useEffect } from 'react';
import { getAiResponses } from './api';
import './images.css';

export default function ImagesPage({ onNavBack }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const data = await getAiResponses();
      let allImages = [];
      if (Array.isArray(data)) {
        data.forEach(item => {
          try {
            if (item.images) {
              const parsed = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
              if (Array.isArray(parsed)) {
                parsed.forEach(imgUrl => {
                  allImages.push({
                    url: imgUrl,
                    question_number: item.question_number,
                    user_name: item.user_name,
                    id: item.id + '-' + allImages.length
                  });
                });
              }
            }
          } catch (e) {
            console.error('Error parsing images for item', item.id, e);
          }
        });
      }
      setImages(allImages);
    } catch (err) {
      setError('Failed to load images from backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="images-app">
      <header className="answer-top answer-top-fixed">
        <h1 className='code-sin'>Images Gallery</h1>
        <button type="button" className="btn-ghost" onClick={onNavBack}>
          &larr; Back to Answer Sheet
        </button>
      </header>

      <div className="images-body">
        {error && <div className="answer-error">{error}</div>}
        
        <div className="images-list-section">
          <h2 className="images-list-title">All Uploaded Images</h2>
          {loading ? (
            <p>Loading images...</p>
          ) : images.length === 0 ? (
            <p className="empty">No images found.</p>
          ) : (
            <div className="images-grid">
              {images.map((img) => (
                <div key={img.id} className="image-card">
                  <div className="image-card-header">
                    <span>Q{img.question_number}</span>
                    <span>by {img.user_name}</span>
                  </div>
                  <img src={img.url} alt={`Q${img.question_number}`} className="image-display" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
