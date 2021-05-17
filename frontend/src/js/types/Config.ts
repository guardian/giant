import PropTypes from 'prop-types';

export const config = PropTypes.shape({
    warning: PropTypes.string,
    userProvider: PropTypes.string.isRequired,
    authConfig: PropTypes.object.isRequired,
    buildInfo: PropTypes.object.isRequired
});

export type Config = {
    warning?: string,
    userProvider: string,
    hideDownloadButton: boolean,
    authConfig: {
        require2FA: boolean,
        minPasswordLength: number
    },
    buildInfo: {
      [info: string]: string
    }
};


