import { useCallback, useEffect, useState } from "react";
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
} from "@elastic/eui";
import authFetch from "../util/auth/authFetch";

interface InputItem {
  bucket: string;
  key: string;
  ageRangeMin: number;
  ageRangeMax: number;
}

type Sentiment = -2 | -1 | 0 | 1 | 2;
type Result =
  | "irrelevant"
  | "Not sure?"
  | ({ sentiment: Sentiment } & (
      | { ageCorrect: true }
      | {
          correctedAgeRange: [number, number];
        }
    ));

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
      const body = `entry.1819610777=${encodeURI(
        bucket,
      )}&entry.1199622271=${encodeURI(key)}&emailAddress=${encodeURI(
        userEmail ?? "DEV@guardian.co.uk",
      )}&entry.1251221752=${currentSentiment}&entry.224851928=${
        isNoteworthy ? "Yes" : "No"
      }&entry.84974372=${encodeURI(notes)}&entry.1815692875=${
        resultOverride === "irrelevant"
          ? "No, irrelevant"
          : resultOverride === "Not sure?"
            ? encodeURI("Not sure?")
            : `Yes&entry.1924877913=${currentAgeMin}&entry.611549584=${currentAgeMax}`
      }`;
      console.debug(body);
      fetch(
        "https://docs.google.com/forms/u/0/d/e/1FAIpQLSebuFuxBPAkZvlZDTVbsLjUFyQ8RdQ5qrUIPFfAFJLuepSQRw/formResponse",
        {
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          referrer:
            "https://docs.google.com/forms/d/e/1FAIpQLSebuFuxBPAkZvlZDTVbsLjUFyQ8RdQ5qrUIPFfAFJLuepSQRw/viewform?fbzx=7603041497167154633",
          body,
          method: "POST",
          mode: "no-cors",
          credentials: "include",
        },
      )
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

  useEffect(() => {
    const keyHandler = ({ key }: KeyboardEvent) => {
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
            maybePreviousInputItem &&
            setCurrentInputItem(maybePreviousInputItem)
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
    document.addEventListener("keyup", keyHandler);
    return () => document.removeEventListener("keyup", keyHandler);
  }, [currentInputItem, isSubmitting, input, storeVerificationResult]);

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
    if (rows.length === 0 || rows[0].length < 4) {
      alert("Pasted data does not have the expected number of columns (4)");
      return;
    }
    if (clear()) {
      const newInput = rows.map(([bucket, key, ageRangeMin, ageRangeMax]) => ({
        bucket,
        key,
        ageRangeMin: parseInt(ageRangeMin),
        ageRangeMax: parseInt(ageRangeMax),
      }));
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
          <EuiBasicTable
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
              },
              {
                field: "key",
                name: "Key",
                width: "min-content",
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
        {input.length > 0 && !maybeCurrentPreSignedUrl && (
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
                autoPlay
                controls
                muted
                loop
                style={{ maxWidth: "100%", height: "calc(100vh - 365px)" }}
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
                <div style={{ marginBottom: "10px" }}>
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
                    style={{ marginBottom: "10px" }}
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <EuiText>Age</EuiText>
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
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <EuiSwitch
                    label="Noteworthy?"
                    checked={isNoteworthy}
                    onChange={(e) => setIsNoteworthy(e.target.checked)}
                  />
                </div>
                <div>
                  <EuiButton
                    color="danger"
                    onClick={() => storeVerificationResult("irrelevant")}
                  >
                    IRRELEVANT (🆉)
                  </EuiButton>{" "}
                  <EuiButton
                    color="accent"
                    onClick={() => storeVerificationResult("Not sure?")}
                  >
                    NOT SURE? (🅽)
                  </EuiButton>{" "}
                  <EuiButton
                    color={isAgeRangeCorrect ? "success" : "warning"}
                    onClick={() => storeVerificationResult()}
                  >
                    AGE {!isAgeRangeCorrect && <strong>NOW</strong>}
                    {isAgeRangeCorrect ? "CORRECT" : "CORRECTED"} (⬇️)
                  </EuiButton>
                </div>
              </>
            )}
          </>
        ) : (
          <h1>
            <em>PASTE FROM THE SPREADSHEET TO GET STARTED</em>
          </h1>
        )}
      </div>
    </div>
  );
};
