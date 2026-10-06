  const sendMessage = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (handleLocalCommand(clean)) return;

    const next = [...messages, { role: 'user' as const, content: clean }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      let response;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await api.post('/api/chat', {
            messages: next.slice(-16),
          });
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      if (!response) throw lastError ?? new Error('AI core request failed');

      const generatedImage = response.data?.image;
      if (generatedImage?.data && generatedImage?.mimeType) {
        setImagePrompt(clean);
        setImageResult(`data:${generatedImage.mimeType};base64,${generatedImage.data}`);
        setImageError('');
        setImageLabOpen(true);
      }

      const routing = response.data?.routing;
      if (routing?.surfaceAction === 'open' && typeof routing.surface === 'string') {
        openRoutedSurface(routing.surface);
      }

      const answer = safeText(
        response.data?.text,
        generatedImage
          ? `Done, ${String(session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email || 'there').trim() || 'there'}. Your image is ready in Image Lab.`
          : 'I could not complete that request. Please try again.',
      );
      setMessages(current => [
        ...current,
        { role: 'assistant', content: answer },
      ]);
      if (voiceEnabled) void speak(answer);
    } catch (error: any) {
      const detail = safeText(error?.response?.data?.error, error?.message || '').trim();
      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          content: detail
            ? `JARVIS AI core error: ${detail}`
            : 'JARVIS AI core is temporarily unavailable. Please try again in a moment.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const getSpeechRecognition = () =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setMessages(current => [...current, { role: 'assistant', content: 'Voice input is not supported by this browser. You can still type to me.' }]);
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (text) setInput(current => current ? current + ' ' + text : text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startPassiveWake = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setPassiveStatus('NOT SUPPORTED');
      return;
    }
    if (passiveRecognitionRef.current) passiveRecognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onstart = () => setPassiveStatus('LISTENING FOR HEY');
    recognition.onend = () => {
      if (passiveWake) setPassiveStatus('RESTARTING');
    };
    recognition.onerror = () => setPassiveStatus('CHECK MIC PERMISSION');
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .slice(-1)
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .toLowerCase();
      if (transcript.includes('hey')) {
        recognition.stop();
        setPassiveStatus('WAKE DETECTED');
        window.setTimeout(() => startListening(), 250);
      }
    };
    passiveRecognitionRef.current = recognition;
    recognition.start();
  };

  const stopPassiveWake = () => {
    passiveRecognitionRef.current?.stop();
    passiveRecognitionRef.current = null;
    setPassiveStatus('OFF');
  };

  const togglePassiveWake = () => {
    const next = !passiveWake;
    setPassiveWake(next);
    if (next) startPassiveWake();
    else stopPassiveWake();
  };

  const exportMemory = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jarvis-memory.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearMemory = () => {
    if (session?.user?.id) localStorage.removeItem(`jarvis-history:${session.user.id}`);
    localStorage.removeItem('jarvis-history');
    audioRef.current?.pause();
    audioRef.current = null;
    setMessages(starter);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
    setCameraActive(false);
  };

  const testCamera = async () => {
    if (cameraActive) {
      stopCamera();
      setCameraStatus('Camera test stopped');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Camera access is not supported by this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (cameraRef.current) cameraRef.current.srcObject = stream;
      setCameraActive(true);
      setCameraStatus('Camera is available. No photo is being captured or saved.');
    } catch {
      setCameraStatus('Camera permission was denied or the camera is unavailable');
    }
  };

  const generateImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || imageBusy) return;
    setImageBusy(true);
    setImageError('');
    try {
      const endpoint = referenceImage ? '/api/image/edit' : '/api/image/generate';
      const response = await api.post(endpoint, referenceImage
        ? { prompt, referenceImage }
        : { prompt });
      const generated = response.data?.image;
      if (!generated?.data || !generated?.mimeType) throw new Error('Invalid image response');
      setImageResult(`data:${generated.mimeType};base64,${generated.data}`);
    } catch (error: any) {
      const detail = String(error?.response?.data?.error || error?.message || '').trim();
      setImageError(detail ? `Image Lab error: ${detail}` : 'I could not generate that image right now. Please try again.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleReferenceImage = async (file: File) => {
    setImageError('');
    try {
      const prepared = await image.resizeIfNeeded(file, {
        maxDimension: 1600,
        maxPixels: 2_000_000,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setReferenceImage({ data: prepared.data, mimeType: prepared.mimeType });
      setReferencePreview(`data:${prepared.mimeType};base64,${prepared.data}`);
    } catch {
      setImageError('I could not prepare that reference image. Try another image.');
    }
  };

  const clearImageLab = () => {
    setImagePrompt('');
    setImageResult(null);
    setImageError('');
    setReferenceImage(null);
    setReferencePreview(null);
  };

  const downloadGeneratedImage = () => {
    if (!imageResult) return;
    const link = document.createElement('a');
    link.href = imageResult;
    const mimeType = imageResult.match(/^data:([^;]+);/)?.[1] || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    link.download = `jarvis-generated-image.${extension}`;
    link.click();
  };

  const runSecurityCheck = () => {
    const results = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      'JARVIS app permissions are user-controlled',
      'No covert camera capture or automatic surveillance is enabled',
      'Mac system lock requires an explicit action outside the browser',
    ];
    setSecurityResults(results);
  };

  const runRepairDiagnostics = async () => {
    if (repairDiagnosticsBusy) return;
    setRepairDiagnosticsBusy(true);
    try {
      const response = await api.get('/api/repair/diagnostics');
      setRepairDiagnostics(response.data || null);
    } catch (error: any) {
      setRepairDiagnostics({
        overallStatus: 'ATTENTION',
        checks: [{
          name: 'Repair Office',
          status: 'ATTENTION',
          evidence: String(error?.response?.data?.error || error?.message || 'Diagnostic request failed.'),
        }],
      });
    } finally {
      setRepairDiagnosticsBusy(false);
    }
  };

  const runSystemCheck = () => {
    const checks = [
      window.isSecureContext ? 'Secure browser context: OK' : 'Secure browser context: check browser security',
      navigator.onLine ? 'Network connection: ONLINE' : 'Network connection: OFFLINE',
      'Local conversation memory: AVAILABLE',
      'AI core: READY',
      'Mac system control: SAFELY RESTRICTED TO EXPLICIT USER ACTIONS',
    ];
    const battery = (navigator as any).getBattery;
    if (battery) checks.push('Battery API: AVAILABLE');
    setSystemResults(checks);
    void runRepairDiagnostics();
  };

  const openSecurityCenter = () => {
    setSecurityOpen(true);
    runSecurityCheck();
  };

  const openBusinessCenter = async () => {
    setBusinessOpen(true);
    try {
      const response = await api.get('/api/business');
      setBusiness(response.data?.business || null);
      setBrandKit(response.data?.brandKit || null);
    } catch {}
  };

  const saveBusiness = async () => {
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business', business || { name: 'My Business' });
      setBusiness(response.data?.business || business);
    } finally { setBusinessBusy(false); }
  };

  const saveBrandKit = async () => {
    if (!business) return;
    setBusinessBusy(true);
    try {
      const response = await api.post('/api/business/brand-kit', brandKit || {});
      setBrandKit(response.data?.brandKit || brandKit);
    } finally { setBusinessBusy(false); }
  };

  const openVideoStudio = async () => {
    setVideoOpen(true);
    setVideoError('');
    setVideoBusy(true);
    try {
      const response = await api.get('/api/video/projects');
      const projects = Array.isArray(response.data?.projects) ? response.data.projects : [];
      setVideoProjects(projects);
      if (projects[0]) {
        const project = projects[0];
        setVideoProject(project);
        const [characters, scenes] = await Promise.all([
          api.get('/api/video/projects/' + project.id + '/characters'),
          api.get('/api/video/projects/' + project.id + '/scenes'),
        ]);
        setVideoCharacters(characters.data?.characters || []);
        setVideoScenes(scenes.data?.scenes || []);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || error?.message || 'Video Engine is unavailable for this plan.');
    } finally { setVideoBusy(false); }
  };

  const createVideoProject = async () => {
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects', {
        title: 'New JARVIS Production',
        description: 'Video production project',
        format: '16:9',
        story_bible: { premise: '', tone: '', continuity: {} },
      });
      const project = response.data?.project;
      if (project) {
        setVideoProject(project);
        setVideoProjects(current => [project, ...current]);
        setVideoCharacters([]);
        setVideoScenes([]);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the video project.');
    } finally { setVideoBusy(false); }
  };

  const createVideoCharacter = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/characters', {
        name: window.prompt('Character name')?.trim() || 'New Character',
        role: window.prompt('Character role')?.trim() || 'Character',
        profile: { personality: '', history: '', speaking_style: '' },
        appearance: { face: '', hair: '', clothing: '', visual_identity: '' },
        voice: { provider: 'elevenlabs', voice_id: '', speaking_style: '' },
        wardrobe: { current: '', allowed_variations: [] },
        relationships: {},
        reference_assets: [],
        continuity_rules: { identity_locked: true },
      });
      setVideoCharacters(current => [...current, response.data?.character].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the character.');
    } finally { setVideoBusy(false); }
  };

  const createVideoScene = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.post('/api/video/projects/' + videoProject.id + '/scenes', {
        scene_number: videoScenes.length + 1,
        title: 'New Scene',
        script: '',
        dialogue: [],
        characters: videoCharacters.map(character => character.id),
        visual_plan: {},
        camera_plan: {},
        audio_plan: { voice_provider: 'elevenlabs' },
        lip_sync_plan: { enabled: true, status: 'planned', character_audio_pairs: [] },
        continuity_notes: { check_character_identity: true, check_world_assets: true },
      });
      setVideoScenes(current => [...current, response.data?.scene].filter(Boolean));
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not create the scene.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoCharacter = async () => {
    if (!videoProject || !editingCharacter) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/characters/' + editingCharacter.id, editingCharacter);
      const saved = response.data?.character;
      if (saved) {
        setVideoCharacters(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingCharacter(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the character.');
    } finally { setVideoBusy(false); }
  };

  const saveVideoScene = async () => {
    if (!videoProject || !editingScene) return;
    setVideoBusy(true); setVideoError('');
    try {
      const response = await api.patch('/api/video/projects/' + videoProject.id + '/scenes/' + editingScene.id, editingScene);
      const saved = response.data?.scene;
      if (saved) {
        setVideoScenes(current => current.map(item => item.id === saved.id ? saved : item));
        setEditingScene(null);
      }
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not save the scene.');
    } finally { setVideoBusy(false); }
  };

  const planVideoProduction = async () => {
    if (!videoProject) return;
    setVideoBusy(true); setVideoError('');
    try {
      await api.post('/api/video/projects/' + videoProject.id + '/plan', {
        requested_outputs: ['storyboard', 'generation_plan', 'voice_plan', 'lip_sync_plan', 'qa_plan'],
      });
      setVideoError('Production plan queued successfully.');
    } catch (error: any) {
      setVideoError(error?.response?.data?.error || 'Could not queue the production plan.');
    } finally { setVideoBusy(false); }
  };

  const openCommand = (command: string) => {
    setCommandOpen(false);
    void sendMessage(command);
  };

  useEffect(() => () => {
    stopCamera();
    recognitionRef.current?.stop();
    passiveRecognitionRef.current?.stop();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!passiveWake) {
      stopPassiveWake();
      return;
    }
    startPassiveWake();
  }, [passiveWake]);

  if (!authReady) {
    return <main className="jarvis-shell"><section className="auth-screen"><div className="auth-card"><div className="orb"><Sparkles size={20} /></div><span className="eyebrow">JARVIS AUTHENTICATION</span><h1>Connecting to JARVIS...</h1><p>Preparing your secure account session.</p></div></section></main>;
  }

  if (!session) {
    return (
      <main className="jarvis-shell">
        <section className="auth-screen">
          <div className="auth-card">
            <div className="orb"><Sparkles size={20} /></div>
            <span className="eyebrow">JARVIS AUTHENTICATION</span>
            <h1>Sign in to JARVIS</h1>
            <p>Choose a secure sign-in method to sync your conversations, preferences, and long-term JARVIS memory.</p>
            {authError && <div className="auth-error">{authError}</div>}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8, marginTop:12 }}>
              <button className="security-primary" onClick={() => void signInWithGoogle()} disabled={authBusy || !supabaseConfigured}>
                {authBusy ? 'Connecting...' : 'Continue with Google'}
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('github','GitHub')} disabled={authBusy || !supabaseConfigured}>
                <Github size={16} /> GitHub
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('azure','Microsoft')} disabled={authBusy || !supabaseConfigured}>
                Microsoft
              </button>
              <button className="security-secondary" onClick={() => void signInWithOAuth('apple','Apple')} disabled={authBusy || !supabaseConfigured}>
                <Apple size={16} /> Apple
              </button>
            </div>

            <div style={{ display:'grid', gap:8, marginTop:14 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button className={authMode === 'signin' ? 'security-primary' : 'security-secondary'} onClick={() => setAuthMode('signin')} disabled={authBusy}>Sign in</button>
                <button className={authMode === 'signup' ? 'security-primary' : 'security-secondary'} onClick={() => setAuthMode('signup')} disabled={authBusy}>Create account</button>
              </div>
              <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email address" autoComplete="email" />
              <input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={authMode === 'signup' ? 'Password (8+ characters)' : 'Password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} onKeyDown={e=>{if(e.key==='Enter') void (authMode === 'signup' ? createEmailAccount() : signInWithEmail());}} />
              <button className="security-primary" onClick={() => void (authMode === 'signup' ? createEmailAccount() : signInWithEmail())} disabled={authBusy || !supabaseConfigured}>
                <Mail size={16} /> {authMode === 'signup' ? 'Create with Email' : 'Continue with Email'}
              </button>
              <button className="security-secondary" onClick={() => void sendMagicLink()} disabled={authBusy || !supabaseConfigured || !authEmail.trim()}>
                Send Magic Link
              </button>
            </div>

            {!supabaseConfigured && <small>Supabase Auth is not configured in this deployment yet.</small>}
            <small style={{ display:'block', marginTop:8, opacity:.75 }}>Additional social buttons require their provider to be enabled in Supabase Auth.</small>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="jarvis-shell">
      <div className="scanline" />
      <header className="topbar">
        <div className="brand">
          <div className="orb">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>JARVIS</strong>
            <span>SVR • FUTURISTIC ASSISTANT</span>
          </div>
        </div>
        <div className="status">
          <span className="pulse" /> SYSTEM ONLINE
        </div>
      </header>

      <section className="dashboard single-chat">
        <section className="chat-panel">
          <div className="chat-head">
            <div>
              <span className="eyebrow">CONVERSATION CORE</span>
              <h1>What can I help you with?</h1>
              <p className="chat-subtitle">Ask JARVIS anything, or use a tool when you need one.</p>
            </div>
            <div className="head-actions">
              <button className={passiveWake ? 'active-control' : ''} title="Toggle passive Hey wake mode" onClick={togglePassiveWake} aria-label="Toggle passive wake">
                <Radio size={18} />
              </button>
              <button title="Toggle voice output" onClick={() => setVoiceEnabled(v => !v)} aria-label="Toggle voice output">
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <span>
                {speaking ? 'SPEAKING' : listening ? 'LISTENING' : busy ? 'THINKING' : passiveWake ? 'PASSIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div className={'message-row ' + message.role} key={index + '-' + message.content.slice(0, 8)}>
                <div className="message-badge">{message.role === 'user' ? 'S' : 'J'}</div>
                <div className="bubble">
                  <span>{message.role === 'user' ? 'YOU' : 'JARVIS'}</span>
                  {message.content && <div className="message-content">{renderRichMessage(message.content)}</div>}
                  {message.image?.data && message.image?.mimeType && (
                    <div className="chat-generated-image">
                      <img src={`data:${message.image.mimeType};base64,${message.image.data}`} alt="JARVIS generated result" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="thinking">
                <span />
                <span />
                <span /> JARVIS is thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-tools" aria-label="JARVIS chat actions">
            {[
              ['Create image', 'Create an image of a cute storybook animal in a magical forest.'],
              ['Children Factory', 'Open children factory'],
              ['Video Lab', 'Open video lab'],
              ['More', 'Open command center'],
            ].map(([label, command]) => (
              <button key={label} onClick={() => void sendMessage(command)} disabled={busy}>{label}</button>
            ))}
          </div>

          <div className="composer">
            <button className={'mic ' + (listening ? 'active' : '')} onClick={startListening} title="Dictate into the message box" aria-label="Start speech to text">
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void sendMessage(); }}
              placeholder={listening ? 'Listening… speak now' : 'Speak or type to JARVIS…'}
              aria-label="Message JARVIS"
            />
            <button className="send" onClick={() => void sendMessage()} disabled={busy || !input.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
          <div className="hint">
            {passiveWake ? 'Passive wake is listening for “Hey” • ' : ''}
            Tap the mic to turn speech into editable text • Voice output {voiceEnabled ? 'ON' : 'OFF'}
          </div>
        </section>
      </section>

      {capabilityOpen && <CapabilityCenter onClose={() => setCapabilityOpen(false)} />}

      {empireOpen && createPortal((
        <div className="empire-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Empire Command">
          <section className="empire-panel">
            <div className="security-head">
              <div><span className="eyebrow">DUAL EMPIRE CORE</span><h2>JARVIS Empire Command</h2><p>Attention operations plus a paper-only Nexora forest laboratory.</p></div>
              <button className="close-security" onClick={() => setEmpireOpen(false)} aria-label="Close empire command"><X size={18} /></button>
            </div>
            <EmpireDashboard />
          </section>
        </div>
      ), document.body)}

      {commandOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Command Center">
          <section className="security-panel command-panel">
            <div className="security-head">
              <div><span className="eyebrow">COMMAND CORE</span><h2>JARVIS Command Center</h2><p>Fast actions for study, engineering, planning and everyday help.</p></div>
              <button className="close-security" onClick={() => setCommandOpen(false)} aria-label="Close command center"><X size={18} /></button>
            </div>
            <div className="command-grid">
              {[
                ['Explain something', 'Explain a topic clearly.'],
                ['Help me study', 'Help me study a topic with a simple plan.'],
                ['Children\'s Content Studio', 'Help me create a children\'s rhyme, story, or learning video.'],
                ['Plan my day', 'Help me make a practical plan for today.'],
                ['Give me an idea', 'Give me a useful creative idea.'],
                ['Remember this', 'Remember the important information I am about to give you.'],
              ].map(([title, prompt]) => (
                <button className="command-card" key={title} onClick={() => openCommand(prompt)}>
                  <BrainCircuit size={18} /><b>{title}</b><span>{prompt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {factoryOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Children Factory">
          <section className="security-panel" style={{ maxWidth: 1000 }}>
            <div className="security-head">
              <div>
                <span className="eyebrow">CHILDREN CONTENT FACTORY V1</span>
                <h2>JARVIS Children Factory</h2>
                <p>Topic → story → character bible → 3 consistent images → 9:16 short → approval.</p>
              </div>
              <button className="close-security" onClick={() => setFactoryOpen(false)} aria-label="Close Children Factory"><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gap:10, marginBottom:18 }}>
              <textarea value={factoryTopic} onChange={e => setFactoryTopic(e.target.value.slice(0,500))} placeholder="Example: A little lion learns not to be afraid of water" rows={3} />
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <label>Age <select value={factoryAge} onChange={e => setFactoryAge(Number(e.target.value))}>{[3,4,5,6,7,8,9,10,11,12].map(age => <option key={age} value={age}>{age}</option>)}</select></label>
                <button className="security-primary" onClick={() => void createChildrenFactory()} disabled={factoryBusy || !factoryTopic.trim()}><Sparkles size={16} /> {factoryBusy ? 'Creating…' : 'Create Children Draft'}</button>
              </div>
            </div>
            {factoryError && <div className="lock-note"><AlertTriangle size={16} /><span>{factoryError}</span></div>}
            {factoryDraft?.draft && <article className="security-card" style={{ display:'block', marginTop:12 }}>
              <span className="eyebrow">{factoryDraft.status === 'scenes_queued' ? 'SCENES IN PROGRESS' : 'CHILDREN FACTORY DRAFT'}</span>
              <h3>{factoryDraft.draft.project?.title || 'Children Story'}</h3>
              <p style={{ whiteSpace:'pre-wrap' }}>{factoryDraft.draft.story}</p>
              <div style={{ display:'grid', gap:6 }}>
                <b>Character Bible</b>
                <span>{factoryDraft.draft.characterBible?.name} · {factoryDraft.draft.characterBible?.species} · {factoryDraft.draft.characterBible?.color} · {factoryDraft.draft.characterBible?.clothes}</span>
                <span>Scene assets: {(factoryDraft.draft.images || []).length}/3 · {String(((factoryDraft.draft.pipeline || []).find((stage:any) => stage.id === 'scene_assets') || {}).status || 'unknown')}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, marginTop:12 }}>
                {(factoryDraft.draft.images || []).map((item:any) => item.media?.url ? <img key={item.scene} src={item.media.url} alt={'Children Factory scene '+item.scene} style={{ width:'100%', borderRadius:10 }} /> : <div key={item.scene} className="lock-note">Scene {item.scene} asset stored</div>)}
                {(factoryDraft.draft.images || []).length < 3 && <div className="lock-note" style={{ gridColumn:'1 / -1' }}>JARVIS Worker is generating the remaining scene assets. The render gate stays locked until all 3 are verified.</div>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                <button className="security-secondary" onClick={() => void renderChildrenFactoryVideo()} disabled={factoryBusy || !(factoryDraft && factoryDraft.draft && factoryDraft.draft.project && factoryDraft.draft.project.id) || ((factoryDraft.draft.images || []).length < 3) || String(((factoryDraft.draft.pipeline || []).find((stage:any) => stage.id === 'scene_assets') || {}).status || '') !== 'completed'}>
                  {factoryDraft.draft.images?.length < 3 ? 'Waiting for scene assets…' : factoryRenderJob && (factoryRenderJob.status === 'running' || factoryRenderJob.status === 'queued') ? 'Rendering 9:16 short…' : 'Render 9:16 Short'}
                </button>
                {factoryDraft && factoryDraft.renderedVideo && factoryDraft.renderedVideo.mediaKey && <button className="security-secondary" onClick={() => { setYoutubeMissionId(String(factoryDraft.approvalGate && factoryDraft.approvalGate.missionId || '')); setYoutubeMediaKey(String(factoryDraft.renderedVideo.mediaKey)); setYoutubeTitle(String(factoryDraft.draft && factoryDraft.draft.project && factoryDraft.draft.project.title || '').slice(0,100)); setYoutubeDescription(String(factoryDraft.draft && factoryDraft.draft.story || '').slice(0,5000)); setFactoryOpen(false); void openYouTubeCenter(); }}>Open YouTube Publisher</button>}
              </div>
              {factoryRenderJob && <div className="security-status"><span>Render job: {factoryRenderJob.status}</span></div>}
              {factoryDraft?.mission?.status === 'failed' && <div className="lock-note" style={{ marginTop:12 }}><AlertTriangle size={16} /><span>{String(factoryDraft.mission?.metadata?.factoryFailure?.message || 'Children Factory stopped after bounded retries. Partial progress was preserved.')}</span></div>}
              <div className="lock-note" style={{ marginTop:12 }}><LockKeyhole size={16} /><span>Rendering creates a stored 9:16 MP4. Publishing is still separate and requires an approved mission.</span></div>
            </article>}
            <div style={{ display:'grid', gap:10, marginTop:16 }}>
              {missions.filter((m:any) => m.metadata?.factory === 'children-v1').map((mission:any) => <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                <Activity size={20} /><div style={{ flex:1 }}><b>{mission.goal}</b><span>Status: {mission.status}</span><span>Approval: {mission.approval?.status || 'not_required'}</span>
                  {mission.status === 'waiting_approval' && mission.approval?.status === 'pending' && <button className="security-primary" onClick={() => void approveChildrenFactory(mission.id)} disabled={factoryBusy} style={{ marginTop:10 }}>Approve Draft</button>}
                  {mission.approval?.status === 'approved' && <span style={{ marginTop:8 }}>Approved. YouTube is the current publishing target. Open YouTube Center from the YouTube command when you are ready to publish.</span>}
                </div>
              </article>)}
            </div>
          </section>
        </div>
      )}

      {missionOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Mission Center">
          <section className="security-panel" style={{ maxWidth: 960 }}>
            <div className="security-head">
              <div>
                <span className="eyebrow">MISSION RUNTIME</span>
                <h2>JARVIS Mission Center</h2>
                <p>Durable missions with explicit approval before image-generation side effects.</p>
              </div>
              <button className="close-security" onClick={() => setMissionOpen(false)} aria-label="Close mission center"><X size={18} /></button>
            </div>

            <div style={{ display:'grid', gap:10, marginBottom:18 }}>
              <textarea
                value={missionPrompt}
                onChange={e => setMissionPrompt(e.target.value)}
                placeholder="Describe the image mission you want JARVIS to run..."
                rows={3}
              />
              <button className="security-primary" onClick={() => { void createImageMission(); }} disabled={missionBusy || !missionPrompt.trim()}>
                <Sparkles size={16} /> Create Image Mission
              </button>
            </div>

            {missionError && <div className="lock-note"><AlertTriangle size={16} /> <span>{missionError}</span></div>}
            {missionBusy && <div className="security-status"><p>Mission Center is updating…</p></div>}

            <div style={{ display:'grid', gap:10 }}>
              {missions.length === 0 && !missionBusy && <div className="lock-note"><Radio size={16} /><span>No missions yet.</span></div>}
              {missions.map(mission => (
                <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                  <Activity size={20} />
                  <div style={{ flex:1 }}>
                    <b>{mission.goal}</b>
                    <span>Status: {mission.status} · Step {Number(mission.currentStep ?? 0) + 1}</span>
                    {mission.approval?.status && <span>Approval: {mission.approval.status}</span>}
                    <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                      {mission.status === 'draft' && mission.autonomy === 'execute_with_approval' && mission.approval?.status === 'not_requested' && (
                        <button className="security-secondary" onClick={() => { void requestMissionApproval(mission.id); }} disabled={missionBusy}>Request approval</button>
                      )}
                      {mission.status === 'draft' && mission.autonomy === 'execute_with_approval' && mission.approval?.status === 'requested' && (
                        <button className="security-primary" onClick={() => { void approveAndStartMission(mission.id); }} disabled={missionBusy}>Approve & Start</button>
                      )}
                      <button className="security-secondary" onClick={() => { void loadMissions(); }} disabled={missionBusy}>Refresh</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {businessOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Business Center">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">BUSINESS OPERATIONS CORE</span><h2>JARVIS Business Center</h2><p>Manage your business profile and Brand Kit so JARVIS can use your business context across future tools.</p></div>
              <button className="close-security" onClick={() => setBusinessOpen(false)} aria-label="Close business center"><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gap:12 }}>
              <input value={business?.name || ''} onChange={e=>setBusiness({...business, name:e.target.value})} placeholder="Business name" />
              <input value={business?.industry || ''} onChange={e=>setBusiness({...business, industry:e.target.value})} placeholder="Industry" />
              <input value={business?.website || ''} onChange={e=>setBusiness({...business, website:e.target.value})} placeholder="Website" />
              <textarea value={business?.description || ''} onChange={e=>setBusiness({...business, description:e.target.value})} placeholder="What does your business do?" />
              <button className="security-primary" onClick={()=>void saveBusiness()} disabled={businessBusy}>{businessBusy ? 'Saving...' : 'Save Business Profile'}</button>
              {business && <div className="security-status">
                <b>Brand Kit</b>
                <input value={brandKit?.brand_voice || ''} onChange={e=>setBrandKit({...brandKit, brand_voice:e.target.value})} placeholder="Brand voice" />
                <input value={brandKit?.visual_style || ''} onChange={e=>setBrandKit({...brandKit, visual_style:e.target.value})} placeholder="Visual style" />
                <input value={brandKit?.image_style || ''} onChange={e=>setBrandKit({...brandKit, image_style:e.target.value})} placeholder="Image style" />
                <input value={brandKit?.video_style || ''} onChange={e=>setBrandKit({...brandKit, video_style:e.target.value})} placeholder="Video style" />
                <button className="security-secondary" onClick={()=>void saveBrandKit()} disabled={businessBusy}>Save Brand Kit</button>
              </div>}
            </div>
          </section>
        </div>
      )}

      {videoOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Video Studio">
          <section className="security-panel video-studio-panel">
            <div className="security-head">
              <div><span className="eyebrow">JARVIS VIDEO ENGINE</span><h2>Video Studio</h2><p>Story → Character Bible → Scenes → Voice → Lip-sync → QA → Render → Publish.</p></div>
              <button className="close-security" onClick={() => setVideoOpen(false)} aria-label="Close Video Studio"><X size={18} /></button>
            </div>
            <div className="video-toolbar">
              <button className="security-primary" onClick={() => void createVideoProject()} disabled={videoBusy}>New Production</button>
              <button className="security-secondary" onClick={() => void createVideoCharacter()} disabled={videoBusy || !videoProject}>Add Character</button>
              <button className="security-secondary" onClick={() => void createVideoScene()} disabled={videoBusy || !videoProject}>Add Scene</button>
              <button className="security-secondary" onClick={() => void planVideoProduction()} disabled={videoBusy || !videoProject}>Plan Production</button>
            </div>
            {videoError && <div className="security-result"><AlertTriangle size={14} /> {videoError}</div>}
            <div className="video-engine-grid">
              <div className="video-card">
                <span className="card-label">PRODUCTION</span>
                <h3>{videoProject?.title || 'No production selected'}</h3>
                <p>{videoProject?.description || 'Create a production to begin.'}</p>
                <div className="video-tags"><span>{videoProject?.format || '16:9'}</span><span>{videoProject?.status || 'draft'}</span><span>Version {videoProject?.current_version || 1}</span></div>
                <h4>Pipeline</h4>
                <div className="video-pipeline">
                  {['Story Director','Character Bible','World / Assets','Scene Director','Visual + Motion','Voice / Audio','Lip-sync','Editing','Continuity QA','Render / Publish'].map((item, i) => <div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span></div>)}
                </div>
              </div>
              <div className="video-card">
                <span className="card-label">CHARACTER BIBLE</span>
                <h3>{videoCharacters.length} Characters</h3>
                <p>Identity, appearance, voice, wardrobe, relationships and continuity are stored separately from scenes.</p>
                <div className="video-list">{videoCharacters.map(character => <button className="video-list-item" key={character.id} onClick={() => setEditingCharacter(JSON.parse(JSON.stringify(character)))}><b>{character.name}</b><span>{character.role || 'Character'} • {character.voice?.provider || 'voice'} • {character.continuity_rules?.identity_locked === false ? 'identity editable' : 'identity locked'}</span></button>)}{!videoCharacters.length && <div className="video-empty">No characters yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">SCENE DIRECTOR</span>
                <h3>{videoScenes.length} Scenes</h3>
                <p>Every scene carries dialogue, camera, visual, audio, continuity and lip-sync planning data.</p>
                <div className="video-list">{videoScenes.map(scene => <button className="video-list-item" key={scene.id} onClick={() => setEditingScene(JSON.parse(JSON.stringify(scene)))}><b>Scene {scene.scene_number}: {scene.title || 'Untitled'}</b><span>{scene.status} • lip-sync {scene.lip_sync_plan?.enabled ? 'enabled' : 'off'}</span></button>)}{!videoScenes.length && <div className="video-empty">No scenes yet.</div>}</div>
              </div>
              <div className="video-card">
                <span className="card-label">LIP-SYNC</span>
                <h3>Scene-aware synchronization</h3>
                <p>JARVIS will map each character's voice track to the correct character and preserve timing through editing and rendering.</p>
                <div className="video-checks"><span>✓ Character → voice mapping</span><span>✓ Dialogue timing</span><span>✓ Scene synchronization</span><span>✓ Final QA gate</span></div>
              </div>
            </div>
            {videoProjects.length > 0 && <div className="video-projects"><b>Recent productions</b>{videoProjects.slice(0,5).map(project => <button key={project.id} onClick={async()=>{setVideoProject(project);const [c,s]=await Promise.all([api.get('/api/video/projects/'+project.id+'/characters'),api.get('/api/video/projects/'+project.id+'/scenes')]);setVideoCharacters(c.data?.characters||[]);setVideoScenes(s.data?.scenes||[]);}}>{project.title}</button>)}</div>}
          </section>
        </div>
      )}

      {editingCharacter && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Character Bible Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">CHARACTER BIBLE</span><h2>Edit {editingCharacter.name}</h2><p>Identity, appearance, voice, wardrobe and continuity are persistent production data.</p></div><button className="close-security" onClick={() => setEditingCharacter(null)} aria-label="Close character editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingCharacter.name || ''} onChange={e=>setEditingCharacter({...editingCharacter,name:e.target.value})} placeholder="Character name" />
              <input value={editingCharacter.role || ''} onChange={e=>setEditingCharacter({...editingCharacter,role:e.target.value})} placeholder="Role" />
              <textarea value={editingCharacter.profile?.personality || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,personality:e.target.value}})} placeholder="Personality" />
              <textarea value={editingCharacter.profile?.history || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,history:e.target.value}})} placeholder="History / backstory" />
              <textarea value={editingCharacter.profile?.speaking_style || ''} onChange={e=>setEditingCharacter({...editingCharacter,profile:{...editingCharacter.profile,speaking_style:e.target.value}})} placeholder="Speaking style" />
              <textarea value={editingCharacter.appearance?.visual_identity || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,visual_identity:e.target.value}})} placeholder="Visual identity" />
              <textarea value={editingCharacter.appearance?.clothing || ''} onChange={e=>setEditingCharacter({...editingCharacter,appearance:{...editingCharacter.appearance,clothing:e.target.value}})} placeholder="Appearance / clothing rules" />
              <input value={editingCharacter.voice?.voice_id || ''} onChange={e=>setEditingCharacter({...editingCharacter,voice:{...editingCharacter.voice,voice_id:e.target.value}})} placeholder="ElevenLabs voice ID (optional)" />
              <textarea value={editingCharacter.wardrobe?.current || ''} onChange={e=>setEditingCharacter({...editingCharacter,wardrobe:{...editingCharacter.wardrobe,current:e.target.value}})} placeholder="Current outfit" />
              <textarea value={editingCharacter.continuity_rules?.notes || ''} onChange={e=>setEditingCharacter({...editingCharacter,continuity_rules:{...editingCharacter.continuity_rules,notes:e.target.value,identity_locked:true}})} placeholder="Continuity rules" />
              <button className="security-primary" onClick={()=>void saveVideoCharacter()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Character Bible'}</button>
            </div>
          </section>
        </div>
      )}

      {editingScene && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="Scene Director Editor">
          <section className="security-panel" style={{ maxWidth: 860 }}>
            <div className="security-head"><div><span className="eyebrow">SCENE DIRECTOR</span><h2>Edit Scene {editingScene.scene_number}</h2><p>Write the actual scene script and production direction before generation.</p></div><button className="close-security" onClick={() => setEditingScene(null)} aria-label="Close scene editor"><X size={18} /></button></div>
            <div style={{display:'grid',gap:10}}>
              <input value={editingScene.title || ''} onChange={e=>setEditingScene({...editingScene,title:e.target.value})} placeholder="Scene title" />
              <textarea style={{minHeight:180}} value={editingScene.script || ''} onChange={e=>setEditingScene({...editingScene,script:e.target.value})} placeholder="Scene script, action and dialogue..." />
              <textarea value={editingScene.visual_plan?.description || ''} onChange={e=>setEditingScene({...editingScene,visual_plan:{...editingScene.visual_plan,description:e.target.value}})} placeholder="Visual direction" />
              <textarea value={editingScene.camera_plan?.shots || ''} onChange={e=>setEditingScene({...editingScene,camera_plan:{...editingScene.camera_plan,shots:e.target.value}})} placeholder="Camera / shot direction" />
              <textarea value={editingScene.audio_plan?.notes || ''} onChange={e=>setEditingScene({...editingScene,audio_plan:{...editingScene.audio_plan,notes:e.target.value}})} placeholder="Voice, music and sound direction" />
              <textarea value={editingScene.continuity_notes?.notes || ''} onChange={e=>setEditingScene({...editingScene,continuity_notes:{...editingScene.continuity_notes,notes:e.target.value}})} placeholder="Continuity notes" />
              <button className="security-primary" onClick={()=>void saveVideoScene()} disabled={videoBusy}>{videoBusy ? 'Saving...' : 'Save Scene Director'}</button>
            </div>
          </section>
        </div>
      )}

      {imageLabOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Image Lab">
          <section className="security-panel" style={{ maxWidth: 920 }}>
            <div className="security-head">
              <div><span className="eyebrow">MULTIMODAL CREATIVE CORE</span><h2>JARVIS Image Lab</h2><p>Generate new images or edit a reference image with natural-language instructions.</p></div>
              <button className="close-security" onClick={() => setImageLabOpen(false)} aria-label="Close image lab"><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want, or describe how to edit the reference image..."
                style={{ width: '100%', minHeight: 120, resize: 'vertical', borderRadius: 12, border: '1px solid #21445b', background: '#071018', color: '#dff7ff', padding: 14, outline: 'none' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, border: '1px dashed #315d72', borderRadius: 12, color: '#8fb5c7', background: '#061018', cursor: 'pointer' }}>
                <Camera size={18} />
                {referencePreview ? 'Replace reference image' : 'Add reference image for editing'}
                <input type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void handleReferenceImage(file); }} />
              </label>
              {referencePreview && <img src={referencePreview} alt="Reference" style={{ maxHeight: 220, width: '100%', objectFit: 'contain', borderRadius: 12, background: '#02060a' }} />}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="security-primary" onClick={() => void generateImage()} disabled={imageBusy || !imagePrompt.trim()}>{imageBusy ? 'Generating...' : referenceImage ? 'Edit / Generate' : 'Generate Image'}</button>
                <button className="security-secondary" onClick={clearImageLab}>Clear</button>
                {imageResult && <button className="security-secondary" onClick={downloadGeneratedImage}><Download size={16} /> Save Image</button>}
              </div>
              {imageError && <div className="security-result"><AlertTriangle size={14} /> {imageError}</div>}
              {imageResult && <img src={imageResult} alt="JARVIS generated result" style={{ width: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 14, border: '1px solid #21445b', background: '#02060a' }} />}
            </div>
          </section>
        </div>
      )}

      {youtubeOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS YouTube Center">
          <section className="security-panel" style={{ maxWidth: 900 }}>
            <div className="security-head">
              <div><span className="eyebrow">YOUTUBE OPERATIONS</span><h2>JARVIS YouTube Center</h2><p>Connect, review analytics, and publish only after an approved mission.</p></div>
              <button className="close-security" onClick={() => setYoutubeOpen(false)} aria-label="Close YouTube Center"><X size={18} /></button>
            </div>
            {youtubeError && <div className="lock-note"><AlertTriangle size={16} /><span>{youtubeError}</span></div>}
            <div className="security-status">
              <p><b>Connection:</b> {youtubeStatus?.connected ? 'Connected' : 'Not connected'}</p>
              {youtubeStatus?.channel && <p><b>Channel:</b> {youtubeStatus.channel.title}</p>}
            </div>
            {!youtubeStatus?.connected && <button className="security-primary" onClick={() => void connectYouTube()} disabled={youtubeBusy}>Connect YouTube</button>}
            {youtubeStatus?.connected && <button className="security-secondary" onClick={() => void loadYouTubeAnalytics()} disabled={youtubeBusy}>Load recent analytics</button>}
            {youtubeAnalytics?.rows && <div className="security-status"><b>Recent daily analytics</b>{youtubeAnalytics.rows.slice(-7).map((row:any[], i:number) => <p key={i}>{row.join(' • ')}</p>)}</div>}
            {youtubeStatus?.connected && <div style={{display:'grid',gap:9,marginTop:16}}>
              <b>Approved Video Publisher</b>
              <input value={youtubeMissionId} onChange={e=>setYoutubeMissionId(e.target.value)} placeholder="Approved mission ID" />
              <input value={youtubeMediaKey} onChange={e=>setYoutubeMediaKey(e.target.value)} placeholder="Stored video media key" />
              <input value={youtubeTitle} onChange={e=>setYoutubeTitle(e.target.value.slice(0,100))} placeholder="YouTube title" maxLength={100} />
              <textarea value={youtubeDescription} onChange={e=>setYoutubeDescription(e.target.value.slice(0,5000))} placeholder="Description" rows={4} />
              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                <label>Privacy <select value={youtubePrivacy} onChange={e=>setYoutubePrivacy(e.target.value as 'private'|'unlisted'|'public')}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>
                <label><input type="checkbox" checked={youtubeMadeForKids} onChange={e=>setYoutubeMadeForKids(e.target.checked)} /> Made for kids</label>
              </div>
              <button className="security-primary" onClick={() => void publishToYouTube()} disabled={youtubePublishBusy || !youtubeMissionId.trim() || !youtubeMediaKey.trim() || !youtubeTitle.trim()}>
                {youtubePublishBusy ? 'Publishing…' : 'Publish Approved Video'}
              </button>
              {youtubePublishResult?.published && <div className="security-status"><p>✓ YouTube confirmed the upload.</p><a href={youtubePublishResult.url} target="_blank" rel="noreferrer">Open published video</a></div>}
            </div>}
            <div className="lock-note" style={{marginTop:14}}><LockKeyhole size={16}/><span>JARVIS requires an approved mission and a stored video asset. Images alone cannot be uploaded as a YouTube video.</span></div>
          </section>
        </div>
      )}

      {systemOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS System Center">
          <section className="security-panel">
            <div className="security-head">
              <div><span className="eyebrow">SYSTEM MONITOR</span><h2>JARVIS System Center</h2><p>Browser-safe diagnostics. No hidden Mac control.</p></div>
              <button className="close-security" onClick={() => setSystemOpen(false)} aria-label="Close system center"><X size={18} /></button>
            </div>
            <div className="system-cards">
              <article className="system-card"><Globe size={18} /><b>Network</b><span>{navigator.onLine ? 'Online' : 'Offline'}</span></article>
              <article className="system-card"><Shield size={18} /><b>Secure Context</b><span>{window.isSecureContext ? 'Protected' : 'Check browser'}</span></article>
              <article className="system-card"><BrainCircuit size={18} /><b>AI Core</b><span>{busy ? 'Thinking' : 'Ready'}</span></article>
              <article className="system-card"><Battery size={18} /><b>Battery</b><span>Browser permission dependent</span></article>
            </div>
            <button className="security-primary" onClick={runSystemCheck}>Run Full System Check</button>
            <div className="security-status">
              {systemResults.map(result => <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>)}
            </div>
            <div className="repair-diagnostics" aria-live="polite">
              <div className="repair-diagnostics-head">
                <div><b>Repair Office</b><span>{repairDiagnosticsBusy ? 'RUNNING READ-ONLY PROBES' : repairDiagnostics?.overallStatus || 'NOT RUN'}</span></div>
                <button type="button" className="repair-refresh" onClick={() => { void runRepairDiagnostics(); }} disabled={repairDiagnosticsBusy}>
                  {repairDiagnosticsBusy ? 'Checking…' : 'Recheck'}
                </button>
              </div>
              {repairDiagnostics?.checks?.map((check: any) => (
                <div className={'repair-check repair-' + String(check.status || 'ATTENTION').toLowerCase()} key={String(check.name)}>
                  <span className="repair-check-status">{String(check.status || 'ATTENTION')}</span>
                  <div><b>{String(check.name)}</b><small>{String(check.evidence || '')}</small></div>
                </div>
              ))}
            </div>
            <div className="lock-note"><Monitor size={16} /><span>Repair Office is read-only in this phase. It can detect and report problems, but it cannot mutate production automatically.</span></div>
          </section>
        </div>
      )}

      {securityOpen && (
        <div className="security-overlay" role="dialog" aria-modal="true" aria-label="JARVIS Security Center">
          <section className="security-panel">
            <div className="security-head">
              <div>
                <span className="eyebrow">DEFENSIVE SYSTEMS</span>
                <h2>JARVIS Security Center</h2>
                <p>User-controlled security tools. No covert monitoring.</p>
              </div>
              <button className="close-security" onClick={() => { stopCamera(); setSecurityOpen(false); }} aria-label="Close security center">
                <X size={18} />
              </button>
            </div>

            <div className="security-grid">
              <article className="security-card">
                <CheckCircle2 size={20} />
                <div>
                  <b>Browser Security</b>
                  <span>Checks the app's secure browser context.</span>
                </div>
              </article>
              <article className="security-card">
                <Camera size={20} />
                <div>
                  <b>Camera Test</b>
                  <span>Only starts after you press the test button. Nothing is saved.</span>
                </div>
              </article>
              <article className="security-card">
                <LockKeyhole size={20} />
                <div>
                  <b>Mac Lock</b>
                  <span>A browser app cannot silently lock macOS. Use your Mac's normal lock command.</span>
                </div>
              </article>
              <article className="security-card">
                <AlertTriangle size={20} />
                <div>
                  <b>Privacy Guard</b>
                  <span>No automatic photos, hidden surveillance, or background camera watcher.</span>
                </div>
              </article>
            </div>

            <div className="security-actions">
              <button className="security-primary" onClick={runSecurityCheck}>Run Security Check</button>
              <button className="security-secondary" onClick={() => { void testCamera(); }}>
                <Camera size={16} /> {cameraActive ? 'Stop Camera Test' : 'Test Camera'}
              </button>
            </div>

            <section className="security-status" aria-label="JARVIS Permissions and Approvals">
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div>
                  <b>Mission Permissions & Approvals</b>
                  <p style={{ margin:'4px 0 0' }}>Review work that requires your approval before JARVIS can perform a governed side effect.</p>
                </div>
                <button className="security-secondary" onClick={() => { void loadMissions(); }} disabled={missionBusy}>
                  {missionBusy ? 'Updating…' : 'Refresh permissions'}
                </button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, marginTop:12 }}>
                <article className="system-card"><LockKeyhole size={16} /><b>Approval Required</b><span>{missions.filter((m:any) => m.approval?.required).length}</span></article>
                <article className="system-card"><AlertTriangle size={16} /><b>Pending</b><span>{missions.filter((m:any) => m.approval?.status === 'pending').length}</span></article>
                <article className="system-card"><Shield size={16} /><b>Controlled</b><span>{missions.filter((m:any) => ['execute_with_approval','execute_within_policy'].includes(m.autonomy)).length}</span></article>
              </div>
              <div style={{ display:'grid', gap:8, marginTop:12 }}>
                {missions.filter((m:any) => m.approval?.required && !['succeeded','canceled'].includes(String(m.status || ''))).slice(0,8).map((mission:any) => {
                  const isChildrenFactory = mission.metadata?.factory === 'children-v1';
                  const waitingForApproval = mission.approval?.status === 'pending' && mission.status === 'waiting_approval';
                  const approvalRequested = mission.approval?.status === 'requested' && mission.status === 'draft';
                  const approvalMissing = mission.approval?.status === 'not_requested' && mission.status === 'draft';
                  return <article key={mission.id} className="security-card" style={{ alignItems:'flex-start' }}>
                    <LockKeyhole size={18} />
                    <div style={{ flex:1 }}>
                      <b>{String(mission.goal || 'Governed mission')}</b>
                      <span>Status: {String(mission.status || 'unknown')} · Autonomy: {String(mission.autonomy || 'unknown')}</span>
                      <span>Approval: {String(mission.approval?.status || 'unknown')}</span>
                      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                        {approvalMissing && <button className="security-secondary" onClick={() => { void requestMissionApproval(mission.id); }} disabled={missionBusy}>Request approval</button>}
                        {approvalRequested && !isChildrenFactory && <button className="security-primary" onClick={() => { void approveAndStartMission(mission.id); }} disabled={missionBusy}>Approve & Start</button>}
                        {waitingForApproval && isChildrenFactory && <button className="security-primary" onClick={() => { void approveChildrenFactory(mission.id); }} disabled={factoryBusy || missionBusy}>Approve</button>}
                        {!['succeeded','canceled','failed'].includes(String(mission.status || '')) && <button className="security-secondary" onClick={() => { void cancelMission(mission.id); }} disabled={missionBusy}>Cancel</button>}
                      </div>
                    </div>
                  </article>;
                })}
                {missions.filter((m:any) => m.approval?.required && !['succeeded','canceled'].includes(String(m.status || ''))).length === 0 && <div className="lock-note"><CheckCircle2 size={16} /><span>No active approval requests. JARVIS will not perform approval-gated work without an explicit approval state.</span></div>}
              </div>
              <div className="lock-note" style={{ marginTop:12 }}><LockKeyhole size={16} /><span>Approval is checked again at the mission/tool boundary. The Security Center only exposes the user's control surface; it does not grant itself permissions.</span></div>
            </section>

            {cameraActive && (
              <div className="camera-test">
                <video ref={cameraRef} autoPlay playsInline muted />
                <p>Live preview only. JARVIS is not taking or storing a photograph.</p>
              </div>
            )}

            <div className="security-status">
              <b>Security status</b>
              <p>{cameraStatus}</p>
              {securityResults.map(result => (
                <div key={result} className="security-result"><CheckCircle2 size={14} /> {result}</div>
              ))}
            </div>

            <div className="lock-note">
              <LockKeyhole size={16} />
              <span>To lock your Mac now, use <b>Control + Command + Q</b>. The web app does not pretend it can perform that system action.</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
