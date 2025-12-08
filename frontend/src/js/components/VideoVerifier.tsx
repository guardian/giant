import {
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  EuiButton,
  EuiRange,
  EuiDualRange,
  EuiText,
  EuiBasicTable,
  EuiLoadingSpinner,
  EuiProgress,
  EuiFieldText,
  EuiSwitch,
  EuiLink,
  EuiFlexGroup,
} from "@elastic/eui";
import authFetch from "../util/auth/authFetch";

interface InputItem {
  bucket: string;
  key: string;
  ageRangeMin: number;
  ageRangeMax: number;
  medianAge: number;
  meanAge: number;
  timestamp: number;
}

type Sentiment = -2 | -1 | 0 | 1 | 2;
type Result =
  | "irrelevant"
  | "Not sure?"
  | "No faces"
  | ({ sentiment: Sentiment } & (
      | { ageCorrect: true }
      | {
          correctedAgeRange: [number, number];
        }
    ));

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSebuFuxBPAkZvlZDTVbsLjUFyQ8RdQ5qrUIPFfAFJLuepSQRw";

export const VideoVerifier = () => {
  const [playbackRate, setPlaybackRate] = useState(4.0);
  const [input, setInput] = useState<InputItem[]>([]);
  const [preSignedUrls, setPreSignedUrls] = useState<Record<string, string>>(
    {},
  );

  const [currentInputItem, setCurrentInputItem] = useState<InputItem | null>(
    null,
  );
  const maybeCurrentPreSignedUrl =
    currentInputItem &&
    preSignedUrls[`${currentInputItem.bucket}/${currentInputItem.key}`];

  const [currentSentiment, setCurrentSentiment] = useState<Sentiment>(0);
  const [isNoteworthy, setIsNoteworthy] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [currentRange, setCurrentRange] = useState<[number, number] | null>(
    null,
  );
  const [currentAgeMin, currentAgeMax] = currentRange || [null, null];
  const isAgeRangeCorrect =
    currentInputItem?.ageRangeMin === currentAgeMin &&
    currentInputItem?.ageRangeMax === currentAgeMax;

  const [results, setResults] = useState<Record<string, Result | null>>({});
  const countOfCompleted = Object.entries(results).length;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const storeVerificationResult = useCallback(
    (resultOverride?: Result) => {
      if (!currentInputItem) {
        alert("Ooops. No item selected");
        return;
      }
      setIsSubmitting(true);
      const { bucket, key } = currentInputItem;
      const isActuallyNoFaces = resultOverride === "No faces";
      const body = `entry.1819610777=${encodeURI(
        bucket,
      )}&entry.1199622271=${encodeURI(key)}&emailAddress=${encodeURI(
        userEmail ?? "DEV@guardian.co.uk",
      )}&entry.1251221752=${currentSentiment}&entry.224851928=${
        isNoteworthy ? "Yes" : "No"
      }&entry.84974372=${encodeURI(isActuallyNoFaces ? `NO FACES - ${notes}` : notes)}&entry.1815692875=${
        resultOverride === "irrelevant"
          ? "No, irrelevant"
          : resultOverride === "Not sure?"
            ? encodeURI("Not sure?")
            : `Yes&entry.1924877913=${isActuallyNoFaces ? NaN : currentAgeMin}&entry.611549584=${isActuallyNoFaces ? NaN : currentAgeMax}`
      }`;
      console.debug(body);
      fetch(`${GOOGLE_FORM_URL}/formResponse`, {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        referrer: `${GOOGLE_FORM_URL}/viewform`,
        body,
        method: "POST",
        mode: "no-cors",
        credentials: "include",
      })
        .then(() => {
          // TODO is there a way to see if success
          setResults((prev) => ({
            ...prev,
            [`${bucket}/${key}`]: resultOverride || {
              sentiment: currentSentiment,
              ...(isAgeRangeCorrect
                ? { ageCorrect: true }
                : { correctedAgeRange: [currentAgeMin!, currentAgeMax!] }),
            },
          }));
        })
        .catch((e) => {
          console.error(e);
          alert(
            "There was an error submitting your response. Please try again.",
          );
        })
        .finally(() => setIsSubmitting(false));
    },
    [
      currentAgeMax,
      currentAgeMin,
      currentInputItem,
      currentSentiment,
      isNoteworthy,
      notes,
      isAgeRangeCorrect,
      userEmail,
    ],
  );

  useEffect(() => {
    if (currentInputItem) {
      setCurrentSentiment(0);
      setIsNoteworthy(false);
      setNotes("");
      setCurrentRange([
        currentInputItem.ageRangeMin,
        currentInputItem.ageRangeMax,
      ]);
    }
  }, [currentInputItem]);

  const clear = () => {
    if (
      input.length === 0 ||
      window.confirm(
        "Are you sure you want to clear this list? (your already submitted results wont be lost)",
      )
    ) {
      setResults({});
      setInput([]);
      setCurrentInputItem(null);
      return true;
    }
  };

  const keyHandler: KeyboardEventHandler<HTMLDivElement> = ({ key }) => {
    if (isSubmitting || !currentInputItem) {
      return;
    }
    switch (key) {
      case "z":
        return storeVerificationResult("irrelevant");
      case "n":
        return storeVerificationResult("Not sure?");
      case "ArrowUp":
        const maybePreviousInputItem = input.find(
          (_, index, arr) => arr[index + 1] === currentInputItem,
        );
        return (
          maybePreviousInputItem && setCurrentInputItem(maybePreviousInputItem)
        );
      case "ArrowDown":
        return storeVerificationResult();
      case "ArrowLeft":
        return setCurrentSentiment(
          (prev) => Math.max(-2, prev - 1) as Sentiment,
        );
      case "ArrowRight":
        return setCurrentSentiment(
          (prev) => Math.min(2, prev + 1) as Sentiment,
        );
    }
  };

  useEffect(() => {
    currentInputItem &&
      document
        .querySelectorAll("tr span")
        .forEach(
          (element) =>
            element.textContent === currentInputItem.key &&
            element.scrollIntoView({ behavior: "smooth", block: "center" }),
        );
  }, [currentInputItem]);

  useEffect(() => {
    const maybeNextInputItem = input.find(
      ({ bucket, key }) => !results[`${bucket}/${key}`],
    );
    if (maybeNextInputItem) {
      setCurrentInputItem(maybeNextInputItem);
    } else if (input.length > 0) {
      setCurrentInputItem(null);
      alert("DONE!");
    }
  }, [results, input]);

  const handlePasteFromSpreadsheet = (data: DataTransfer) => {
    const text = data.getData("text/plain");
    if (!text?.trim()) {
      return;
    }
    const rows = text.split("\n").map((row) => row.split("\t"));
    if (rows.length === 0 || rows[0].length < 7) {
      alert("Pasted data does not have the expected number of columns (7)");
      return;
    }
    if (clear()) {
      const newInput = rows.map(
        ([
          bucket,
          key,
          ageRangeMin,
          ageRangeMax,
          medianAge,
          maxAge,
          timestamp,
        ]) => ({
          bucket,
          key,
          ageRangeMin: parseInt(ageRangeMin),
          ageRangeMax: parseInt(ageRangeMax),
          medianAge: parseInt(medianAge),
          meanAge: parseInt(maxAge),
          timestamp: parseFloat(timestamp),
        }),
      );
      setInput(newInput);
    }
  };

  useEffect(() => {
    if (input.length > 0) {
      authFetch(`/api/video-verifier/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      })
        .then((response) => {
          const email = response.headers.get("X-UserEmail");
          email?.includes("@") && setUserEmail(email);
          return response.json();
        })
        .then(setPreSignedUrls);
    }
  }, [input]);

  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        padding: "10px",
        minWidth: "100%",
        justifyContent: "space-between",
      }}
      onPaste={(e) => handlePasteFromSpreadsheet(e.clipboardData)}
      tabIndex={0} // to make key handler work
      onKeyUp={keyHandler}
    >
      <div style={{ width: "67vw" }}>
        <p>Enter video URLs below (one per line):</p>
        <div
          style={{
            overflowY: "scroll",
            position: "relative",
            maxHeight: "calc(100vh - 200px)",
            marginBottom: "10px",
          }}
        >
          <EuiBasicTable<InputItem>
            items={input}
            tableLayout="auto"
            css={{
              th: {
                position: "sticky",
                top: 0,
                background: "white",
                zIndex: 99,
              },
            }}
            rowProps={(item) => ({
              onClick: () => setCurrentInputItem(item),
              css: {
                fontWeight:
                  currentInputItem?.bucket === item.bucket &&
                  currentInputItem?.key === item.key
                    ? "bold"
                    : "normal",
                td: {
                  color: results[`${item.bucket}/${item.key}`]
                    ? "lightgray"
                    : "inherit",
                },
              },
            })}
            columns={[
              {
                field: "bucket",
                name: "Bucket",
                style: {
                  fontSize: "50%",
                },
              },
              {
                field: "key",
                name: "Key",
                width: "min-content",
                style: {
                  fontSize: "50%",
                },
              },
              {
                field: "ageRangeMin",
                name: "Age Range Min",
                align: "right",
              },
              {
                field: "ageRangeMax",
                name: "Age Range Max",
              },
              {
                field: "medianAge",
                name: "Median Age",
                align: "center",
              },
              {
                field: "meanAge",
                name: "Mean Age",
                align: "center",
              },
              {
                field: "timestamp",
                name: "Timestamp",
                align: "right",
                render: (timestamp: number, item) => (
                  <EuiLink
                    onClick={() => {
                      setTimeout(() => {
                        if (videoPlayerRef.current) {
                          videoPlayerRef.current.currentTime = timestamp;
                        }
                      }, 250); // allows the video to be swapped out via react state/render
                    }}
                  >
                    {timestamp.toFixed(0)}s
                  </EuiLink>
                ),
              },
            ]}
            rowHeader="test"
            noItemsMessage={
              "PASTE SOME ROWS FROM THE SPREADSHEET (matching the above headings)"
            }
          />
        </div>
        {input && (
          <EuiProgress
            label="Progress"
            value={countOfCompleted}
            max={input.length}
            size="l"
            valueText={`${countOfCompleted} of ${input.length}`}
          />
        )}
        <div style={{ marginTop: "10px" }}>
          <EuiButton disabled={input.length === 0} onClick={clear}>
            CLEAR
          </EuiButton>
        </div>
      </div>
      <div style={{ width: "33vw", textAlign: "center" }}>
        {input.length > Object.keys(preSignedUrls).length && (
          <div>
            <EuiLoadingSpinner /> LOADING TEMPORARY URLs{" "}
          </div>
        )}
        {currentInputItem && maybeCurrentPreSignedUrl ? (
          <>
            <label>
              Playback Rate:
              <input
                type="range"
                min="0.25"
                max="10.0"
                step="0.25"
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  const videoElement = document.querySelector("video");
                  if (videoElement) {
                    videoElement.playbackRate = rate;
                  }
                }}
              />
              {playbackRate.toFixed(2)}x
            </label>
            <div>
              <video
                ref={videoPlayerRef}
                autoPlay
                controls
                muted
                loop
                style={{ maxWidth: "100%", height: "calc(100vh - 380px)" }}
                onPlay={(e) => {
                  // @ts-ignore
                  e.target.playbackRate = playbackRate;
                }}
                src={maybeCurrentPreSignedUrl}
              />
            </div>
            {isSubmitting ? (
              <div>
                <EuiLoadingSpinner /> submitting...
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "25px" }}>
                  <EuiText>(⬅️) Sentiment w.r.t. skincare (➡️)</EuiText>
                  <EuiRange
                    value={currentSentiment.toString()}
                    onChange={(e) =>
                      setCurrentSentiment(
                        parseInt(e.currentTarget.value) as Sentiment,
                      )
                    }
                    max={2}
                    min={-2}
                    showTicks
                    step={1}
                    ticks={[
                      { label: "critical", value: -2 },
                      {
                        label: (
                          <span>
                            slightly
                            <br />
                            critical
                          </span>
                        ),
                        value: -1,
                      },
                      { label: "neutral", value: 0 },
                      {
                        label: (
                          <span>
                            slightly
                            <br />
                            positive
                          </span>
                        ),
                        value: 1,
                      },
                      {
                        label: (
                          <span>
                            positive/
                            <br />
                            pushing
                          </span>
                        ),
                        value: 2,
                      },
                    ]}
                    fullWidth
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <EuiText>
                    Age{" "}
                    <span style={{ fontSize: "70%" }}>
                      (of active/actual people in the video)
                    </span>
                  </EuiText>
                  {currentRange && (
                    <EuiDualRange
                      min={0}
                      max={50}
                      step={1}
                      value={currentRange}
                      onChange={([lower, upper]) =>
                        setCurrentRange([
                          parseInt(lower.toString()),
                          parseInt(upper.toString()),
                        ])
                      }
                      showInput
                      aria-label="age range"
                      tickInterval={5}
                      showTicks
                      fullWidth
                      isDraggable
                    />
                  )}
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <EuiFieldText
                    fullWidth
                    value={notes}
                    placeholder="add any notes here... (optional)"
                    onChange={(e) => setNotes(e.target.value)}
                    onKeyUp={(e) => {
                      e.stopPropagation(); // ensures the keyboard shortcuts don't trigger while typing notes
                    }}
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <EuiSwitch
                    label="Noteworthy?"
                    checked={isNoteworthy}
                    onChange={(e) => setIsNoteworthy(e.target.checked)}
                  />
                </div>
                <EuiFlexGroup gutterSize="s">
                  <EuiButton
                    color="danger"
                    onClick={() => storeVerificationResult("irrelevant")}
                    textProps={{ style: { whiteSpace: "normal" } }}
                  >
                    (🆉) IRRELEVANT
                  </EuiButton>
                  <EuiButton
                    color="accent"
                    onClick={() => storeVerificationResult("Not sure?")}
                    textProps={{ style: { whiteSpace: "normal" } }}
                  >
                    (🅽) NOT&nbsp;SURE?
                  </EuiButton>
                  <EuiButton
                    color="ghost"
                    onClick={() => storeVerificationResult("No faces")}
                    textProps={{ style: { whiteSpace: "normal" } }}
                  >
                    NO ACTIVE FACES
                  </EuiButton>
                  <EuiButton
                    color={isAgeRangeCorrect ? "success" : "warning"}
                    onClick={() => storeVerificationResult()}
                    textProps={{ style: { whiteSpace: "normal" } }}
                  >
                    (⬇️) AGE&nbsp;{!isAgeRangeCorrect && <strong>NOW </strong>}
                    {isAgeRangeCorrect ? "CORRECT" : "CORRECTED"}
                  </EuiButton>
                </EuiFlexGroup>
              </>
            )}
          </>
        ) : (
          <h1>
            <em>PASTE FROM THE SPREADSHEET TO GET STARTED</em>
            <iframe
              title="Google form used to submit results to (silently in the background)"
              src={`${GOOGLE_FORM_URL}/viewform?embedded=true`}
              height={300}
            ></iframe>
            <EuiText>
              If the above is showing an error OR not showing your work google
              account then DO NOT PROCEED (as your results will disappear into
              the ether) - contact Digital Investigations for help.
            </EuiText>
          </h1>
        )}
      </div>
    </div>
  );
};
