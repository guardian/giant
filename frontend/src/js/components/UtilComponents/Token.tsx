import React from "react"
import { GiantState } from "../../types/redux/GiantState"

import { connect } from "react-redux"

type Props = ReturnType<typeof mapStateToProps>

class Token extends React.Component<Props> {
    render() {
        return (
            <div className="app__main-content">
                {/* Whistleflow relies on this id */}
                <div id="giant-api-token">{this.props.auth.jwtToken}</div>
            </div>
        )
    }
}

function mapStateToProps(state: GiantState) {
    return {
        config: state.app.config,
        auth: state.auth,
    }
}

function mapDispatchToProps() {
    return {}
}

export default connect(mapStateToProps, mapDispatchToProps)(Token)
