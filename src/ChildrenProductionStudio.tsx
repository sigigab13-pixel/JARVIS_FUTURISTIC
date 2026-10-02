import { useState } from 'react';
import { api } from './api';

const genres = ['rhymes', 'bedtime story', 'adventure', 'educational story', 'moral story', 'science story'];
const formats = ['16:9', '9:16', '1:1'];

export default function ChildrenProductionStudio() {
  const [idea, setIdea] = useState('');
  const [genre, setGenre] = useState('bedtime story');
  const [ageRange, setAgeRange] = useState('6-10');
  const [lesson, setLesson] = useState('');
  const [characters, setCharacters] = useState('');
  const [format, setFormat] = useState('16:9');
  const [story, setStory] = useState<any>(null);
  const [pack, setPack] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createStory = async () => {
    if (!idea.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/api/children/story', {
        idea,
        genre,
        ageRange,
        lesson,
        characters: characters.split(',').map(x => x.trim()).filter(Boolean),
        length: 'medium',
      });
      setStory(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Story creation is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const buildPack = async () => {
    if (!story?.content || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/api/children/story-pack', {
        title: story.title,
        story: story.content,
        genre,
        ageRange,
        characters: characters.split(',').map(x => x.trim()).filter(Boolean),
        productionTypes: ['full episode', 'short clip', 'rhyme', 'educational clip'],
      });
      setPack(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Story Pack creation is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{display:'grid',gap:16,padding:20}}>
      <div>
        <span className="eyebrow">JARVIS CHILDREN'S CONTENT ENGINE</span>
        <h2>Children's Production Studio</h2>
        <p>One original story can become an episode, clips, a rhyme and an educational moment.</p>
      </div>

      <div style={{display:'grid',gap:10}}>
        <textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Story idea..." />
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
          <select value={genre} onChange={e=>setGenre(e.target.value)}>{genres.map(x=><option key={x}>{x}</option>)}</select>
          <input value={ageRange} onChange={e=>setAgeRange(e.target.value)} placeholder="Age range" />
          <select value={format} onChange={e=>setFormat(e.target.value)}>{formats.map(x=><option key={x}>{x}</option>)}</select>
        </div>
        <input value={lesson} onChange={e=>setLesson(e.target.value)} placeholder="Lesson or learning goal (optional)" />
        <input value={characters} onChange={e=>setCharacters(e.target.value)} placeholder="Characters, separated by commas" />
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="security-primary" onClick={()=>void createStory()} disabled={busy || !idea.trim()}>{busy ? 'Working...' : 'Create Story'}</button>
          <button className="security-secondary" onClick={()=>void buildPack()} disabled={busy || !story?.content}>Build Story Pack</button>
        </div>
      </div>

      {error && <div className="security-result">{error}</div>}

      {story && (
        <article className="video-card">
          <span className="card-label">MASTER STORY</span>
          <h3>{story.title}</h3>
          <p style={{whiteSpace:'pre-wrap'}}>{story.content}</p>
        </article>
      )}

      {pack && (
        <article className="video-card">
          <span className="card-label">PRODUCTION PLAN</span>
          <h3>{pack.title}</h3>
          <div className="video-tags"><span>{format}</span><span>{pack.ageRange}</span><span>{pack.qa?.status || 'pending'}</span></div>
          <div className="video-pipeline">
            {[
              ['01','Story'],['02','Character Bible'],['03','Scenes'],['04','Full Episode'],
              ['05','Short Clips'],['06','Rhyme'],['07','Educational Clip'],
              ['08','Thumbnail'],['09','QA'],['10','Render / Publish']
            ].map(([n,label])=><div key={n}><b>{n}</b><span>{label}</span></div>)}
          </div>
          <p><b>Render:</b> {pack.render?.status || 'not_started'} · <b>Publish:</b> {pack.publish?.status || 'not_started'}</p>
          <p>JARVIS is planning these outputs. Rendering and publishing require connected services and confirmation.</p>
        </article>
      )}
    </section>
  );
}
