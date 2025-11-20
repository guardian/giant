import {useEffect, useState} from "react";
import {EuiButton} from "@elastic/eui";

const LOCAL_STORAGE_KEY = "video-verifier-results";

export const VideoVerifier = () => {
  const [playbackRate, setPlaybackRate] = useState(4.0);
  const [rawText, setRawText] = useState("");

  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const [result, setResult] = useState<Record<string, (boolean | null)>>({});

  const setVerificationResult = (url: string | null, result: boolean) => {
    if(url) {
      setResult(prev => ({...prev, [url]: result}))
    }
  }

  const clearResults = () => {
    if(window.confirm("Are you sure you want to discard all the results?")){
      setResult({});
      setRawText("");
      setCurrentUrl(null);
    }
  }

  const downloadResults = () => {
    const lines = Object.entries(result).map(([url, verified]) => JSON.stringify({url, verified}));
    const dataStr = "data:application/octet-stream;charset=utf-8," + encodeURIComponent(lines.join("\n"));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "video-verification-results.jsonl");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  useEffect(() => {
    setResult(prev => rawText.split("\n").reduce((acc, url) => {
      const trimmed = url.trim();
      if (trimmed.length === 0) {
        return acc;
      }
      return {
        ...acc,
        [trimmed]: acc[trimmed] ?? null
      };
    }, prev));
  }, [rawText]);

  useEffect(() => {
    const maybePreviousResultsStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    if(maybePreviousResultsStr){
      const restoredResult = JSON.parse(maybePreviousResultsStr);
      setResult(restoredResult);
      setRawText(Object.keys(restoredResult).join("\n"));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
  }, [result]);

  useEffect(() => {
    const keyHandler = ({key}: KeyboardEvent) => {
        if (currentUrl && key === "c"){
          setVerificationResult(currentUrl, true);
        }
        if (currentUrl && key === "n"){
          setVerificationResult(currentUrl, false);
        }
    }
    document.addEventListener("keyup", keyHandler);
    return () => document.removeEventListener("keyup", keyHandler);
  }, [currentUrl]);

  const isResultsEmpty = Object.keys(result).length === 0;

  useEffect(() => {
    const maybeNextUnverifiedUrl = Object.entries(result).find(([_, verified]) => verified === null)?.[0];
    if(maybeNextUnverifiedUrl) {
      // TODO consider a timeout here with an interstitial screen
      setCurrentUrl(maybeNextUnverifiedUrl);
    } else if (Object.keys(result).length > 0) {
      setCurrentUrl(null);
      alert("DONE! you should download the results now...")
    }
  }, [result]);

  return <div style={{display: "flex", gap: "10px", padding: "10px", minWidth: "100%", justifyContent: "space-between"}}>
    <div style={{width: "33vw"}}>
      <p>Enter video URLs below (one per line):</p>
      <textarea style={{width: "100%", whiteSpace: "pre", overflowWrap: "normal", overflowX: "scroll"}} rows={25} value={rawText} onChange={e => setRawText(e.target.value)}></textarea>
    </div>
    <div style={{width: "33vw", textAlign: "center"}}>
      <label>
        Playback Rate:
        <input type="range" min="0.25" max="5.0" step="0.25" value={playbackRate} onChange={(e) => {
          const rate = parseFloat(e.target.value);
          setPlaybackRate(rate);
          const videoElement = document.querySelector('video');
          if (videoElement) {
            videoElement.playbackRate = rate;
          }
        }}/>
        {playbackRate.toFixed(2)}x
      </label>
      <div>
        {currentUrl ? (
          <video autoPlay controls muted style={{maxWidth: '100%', height: 'auto'}} onPlay={e => {
            // @ts-ignore
            e.target.playbackRate = playbackRate
          }}>
            <source src={currentUrl} type="video/mp4"/>
          </video>
        ) : <strong><em>PASTE SOME URLs TO GET STARTED</em></strong>}
      </div>
      <div>
        <EuiButton disabled={!currentUrl} color="success" onClick={() => setVerificationResult(currentUrl, true)}>
          <strong>IS</strong>A CHILD (🅲)
        </EuiButton>
        {" "}
        <EuiButton disabled={!currentUrl} color="danger" onClick={() => setVerificationResult(currentUrl, false)}>
          <strong>NOT</strong>A CHILD (🅽)
        </EuiButton>
      </div>
    </div>
    <div style={{width: "33vw", textAlign: "right"}}>
      <div>
        <EuiButton disabled={isResultsEmpty} onClick={downloadResults}>Download</EuiButton>{" "}
        <EuiButton disabled={isResultsEmpty} onClick={clearResults}>CLEAR</EuiButton>
      </div>
      <ul style={{overflowY: "auto", maxHeight: "80vh", padding: 0, listStyleType: "none"}}>
        {Object.entries(result).map(([url, verified]) => (
          <li key={url} style={{
            color: verified === null ? "grey" : verified ? "green" : "red",
            fontWeight: url === currentUrl ? "bold" : undefined,
            cursor: "pointer"
          }}
          onClick={() => setCurrentUrl(url)}
          >{url.length < 60 ? url : `${url.slice(0, 18)}  ...  ${url.slice(url.length-32)}`}</li>
        ))}
      </ul>
    </div>
  </div>
}
