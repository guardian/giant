import PropTypes from "prop-types";

export type SearchFilterOptionType = {
  value: string;
  display: string;
  explanation?: string;
  suboptions?: SearchFilterOptionType[];
};

export type SearchFilterType = {
  key: string;
  display?: string;
  options?: SearchFilterOptionType[];
};

function lazyFunction(f: Function) {
  return function (this: any) {
    return f.apply(this, arguments);
  };
}

export const searchFilterOption = PropTypes.shape({
  value: PropTypes.string.isRequired,
  display: PropTypes.string.isRequired,
  explanation: PropTypes.string,
  suboptions: PropTypes.arrayOf(lazyFunction(() => searchFilterOption)),
});

export const searchFilter = PropTypes.shape({
  key: PropTypes.string.isRequired,
  display: PropTypes.string,
  options: PropTypes.arrayOf(searchFilterOption),
});
