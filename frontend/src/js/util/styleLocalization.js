import i18n from '../i18n';

export default function directionalStyle(baseClass) {
    if (i18n.dir(i18n.language) == 'rtl') {
        return baseClass + '--rtl';
    }
    return baseClass;
}
