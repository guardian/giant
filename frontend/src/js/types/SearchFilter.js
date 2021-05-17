import PropTypes from 'prop-types';

function lazyFunction(f) {
    return function() {
        return f.apply(this, arguments);
    };
}

export const searchFilterOption = PropTypes.shape({
    value: PropTypes.string.isRequired,
    display: PropTypes.string.isRequired,
    explanation: PropTypes.string,
    suboptions: PropTypes.arrayOf(lazyFunction(() => searchFilterOption))
});

export const searchFilter = PropTypes.shape({
    key: PropTypes.string.isRequired,
    display: PropTypes.string,
    options: PropTypes.arrayOf(searchFilterOption)
});
