import {
  layoutComments,
  groupCommentsByTop,
  CommentGroup,
} from "./CommentPanel";
import { CommentData } from "../../../types/Resource";
import { HighlightRenderedPositions } from "../TextPreview";

function comment({
  id,
  postedAt,
}: {
  id: string;
  postedAt: number;
}): CommentData {
  return {
    id,
    postedAt,
    author: { username: "test", displayName: "test" },
    text: "test",
  };
}

describe("groupCommentsByTop", () => {
  test("only comments with a top and height are included", () => {
    const comments = [
      comment({ id: "1", postedAt: 1 }),
      comment({ id: "2", postedAt: 2 }),
    ];

    const tops: HighlightRenderedPositions = {
      "1": { top: 5 },
    };

    const heights = {
      "1": 10,
    };

    const expected: CommentGroup[] = [
      // height in a CommentGroup includes the margin below the group
      { top: 5, height: 20, comments: [{ id: "1", height: 10, postedAt: 1 }] },
    ];

    expect(groupCommentsByTop(comments, tops, heights, 10)).toStrictEqual(
      expected,
    );
  });

  test("return groups in order on the page (top)", () => {
    const comments = [
      comment({ id: "1", postedAt: 1 }),
      comment({ id: "2", postedAt: 2 }),
    ];

    const tops: HighlightRenderedPositions = {
      "1": { top: 5 },
      "2": { top: 10 },
    };

    const heights = {
      "1": 10,
      "2": 10,
    };

    const expected: CommentGroup[] = [
      { top: 5, height: 20, comments: [{ id: "1", height: 10, postedAt: 1 }] },
      { top: 10, height: 20, comments: [{ id: "2", height: 10, postedAt: 2 }] },
    ];

    expect(groupCommentsByTop(comments, tops, heights, 10)).toStrictEqual(
      expected,
    );
  });

  test("return comments sorted by timestamp within group", () => {
    const comments = [
      comment({ id: "2", postedAt: 2 }),
      comment({ id: "1", postedAt: 1 }),
    ];

    const tops: HighlightRenderedPositions = {
      "1": { top: 5 },
      "2": { top: 5 },
    };

    const heights = {
      "1": 10,
      "2": 10,
    };

    const expected: CommentGroup[] = [
      {
        top: 5,
        height: 40,
        comments: [
          { id: "1", height: 10, postedAt: 1 },
          { id: "2", height: 10, postedAt: 2 },
        ],
      },
    ];

    expect(groupCommentsByTop(comments, tops, heights, 10)).toStrictEqual(
      expected,
    );
  });
});

describe("layoutComments", () => {
  test("handles no comments", () => {
    const result = layoutComments([], 10, undefined);
    expect(result).toStrictEqual({});
  });

  test("layout linearly", () => {
    // height in a CommentGroup includes all the margins between the member comments
    const input: CommentGroup[] = [
      {
        top: 5,
        height: 40,
        comments: [
          { id: "1", height: 10, postedAt: 1 },
          { id: "2", height: 20, postedAt: 2 },
        ],
      },
      { top: 60, height: 20, comments: [{ id: "3", height: 10, postedAt: 3 }] },
    ];

    const expected = {
      "1": 5,
      "2": 25,
      "3": 60,
    };

    expect(layoutComments(input, 10, undefined)).toStrictEqual(expected);
    expect(layoutComments(input, 10, "1")).toStrictEqual(expected);
  });

  test("center around selected comment", () => {
    const input: CommentGroup[] = [
      {
        top: 5,
        height: 40,
        comments: [
          { id: "1", height: 10, postedAt: 1 },
          { id: "2", height: 20, postedAt: 2 },
        ],
      },
      { top: 60, height: 20, comments: [{ id: "3", height: 10, postedAt: 3 }] },
    ];

    const expected = {
      "1": -15,
      "2": 5,
      "3": 60,
    };

    expect(layoutComments(input, 10, "2")).toStrictEqual(expected);
  });

  test("pull up a group that overlaps with the selected comment", () => {
    const input: CommentGroup[] = [
      {
        top: 5,
        height: 40,
        comments: [
          { id: "1", height: 10, postedAt: 1 },
          { id: "2", height: 20, postedAt: 2 },
        ],
      },
      { top: 40, height: 20, comments: [{ id: "3", height: 10, postedAt: 3 }] },
    ];

    const expected = {
      "1": 0,
      "2": 20,
      "3": 40,
    };

    expect(layoutComments(input, 10, "3")).toStrictEqual(expected);
  });

  test("cascade pull up multiple groups above the selected comment", () => {
    const input: CommentGroup[] = [
      {
        top: 5,
        height: 40,
        comments: [
          { id: "1", height: 10, postedAt: 1 },
          { id: "2", height: 20, postedAt: 2 },
        ],
      },
      { top: 40, height: 10, comments: [{ id: "3", height: 10, postedAt: 3 }] },
      { top: 45, height: 20, comments: [{ id: "4", height: 20, postedAt: 4 }] },
    ];

    const expected = {
      "1": -5,
      "2": 15,
      "3": 35,
      "4": 45,
    };

    expect(layoutComments(input, 10, "4")).toStrictEqual(expected);
  });
});
