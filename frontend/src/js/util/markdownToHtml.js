// Very limited markdown converter, useful for tooltips
export default function markdownToHtml(markdown) {
    var html = markdown;
    var count = (html.match(/`/g) || []).length;
    while(count > 1) {
        html = html.replace('`', '<code>');
        html = html.replace('`', '</code>');
        count = (html.match(/`/g) || []).length;
    }
    return html;
}
