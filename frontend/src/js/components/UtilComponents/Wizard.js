import React from 'react';
import PropTypes from 'prop-types';

import {WizardSlide} from '../../types/WizardSlide';

export class Wizard extends React.Component {
    static propTypes = {
        title: PropTypes.string.isRequired,
        slides: PropTypes.arrayOf(WizardSlide).isRequired,
        onFinish: PropTypes.func.isRequired
    }

    state = {
        index: 0,
        data: {}
    }

    getCurrentSlide() {
        return this.props.slides[this.state.index];
    }

    getCurrentSlideRef() {
        let refValue =  this.activeSlide;

        // Unwrap Redux connected components
        while (refValue.getWrappedInstance) {
            refValue = refValue.getWrappedInstance();
        }

        return refValue;
    }

    previousSlide = () => {
        if (this.state.index > 0) {
            this.setState({
                index: this.state.index - 1
            });
        }
    }

    nextSlide = () => {
        if (this.getCurrentSlide().validate(this.getCurrentSlideRef().state)) {
            this.setState({
                index: this.state.index + 1,
                data: Object.assign({}, this.state.data, this.getCurrentSlideRef().state)
            });
        }
    }

    onFinish = () => {
        if (this.getCurrentSlide().validate(this.getCurrentSlideRef().state)) {
            this.props.onFinish(Object.assign({}, this.state.data, this.getCurrentSlideRef().state));
        }
    }

    render() {
        let currentSlide = this.getCurrentSlide().slide;

        let refSlide = Object.assign({
            ref: (slide) => this.activeSlide = slide,
        }, this.state.data);

        let renderSlide = React.cloneElement(currentSlide, refSlide);

        return (
            <div>
                <h1>{this.props.title}</h1>
                <div className='wizard__breadcrumbs'>
                    {
                        this.props.slides.map((slide, index) =>
                            <WizardBreadcrumb key={slide.title} title={slide.title} done={this.state.index > index}/>)
                    }
                </div>

                <div>
                    {renderSlide}
                </div>

                <div className='wizard__buttons'>
                    {this.state.index > 0 ? <button className='btn' onClick={this.previousSlide}>Back</button> : <div/>}
                    <button className='btn'
                        onClick={
                            this.state.index === this.props.slides.length - 1
                            ?
                            this.onFinish
                            :
                            this.nextSlide
                        }>
                        {this.state.index === this.props.slides.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        );
    }
}

class WizardBreadcrumb extends React.Component {
    static propTypes = {
        done: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired
    }

    render() {
        return (
                <div className='wizard__breadcrumb'>
                    <div className='wizard__breadcrumb-text'>{this.props.title}</div>
                    <div className={this.props.done ? 'wizard__breadcrumb-box--done' : 'wizard__breadcrumb-box'} />
                </div>
        );
    }
}
