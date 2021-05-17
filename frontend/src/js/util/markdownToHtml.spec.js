import markdownToHtml from './markdownToHtml';

test('correctly convert with no backticks', () => {
    expect(markdownToHtml('test text no backticks')).toBe('test text no backticks');
});

test('correctly convert with one backtick', () => {
    expect(markdownToHtml('test `text one backtick')).toBe('test `text one backtick');
});

test('correctly convert with two backticks', () => {
    expect(markdownToHtml('test `text` two backticks')).toBe('test <code>text</code> two backticks');
});

test('correctly convert with three backticks', () => {
    expect(markdownToHtml('test `text` three `backticks')).toBe('test <code>text</code> three `backticks');
});
