export default function(s) {
        return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
