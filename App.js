class App extends React.Component {
    constructor(props) {
        super(props);
        this.model = null;
        this.ctx = null;
        this.state = {
            modelReady: false,
            modelOption: {
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2,
            },
            foregroundColor: {r: 0, g: 0, b: 0, a: 255},
            backgroundColor: {r: 0, g: 0, b: 0, a: 0},
            height: 400,
            width: 400,
            backgroundMode: 'video',
            backgroundSrc: '/images/octagon-5192.mp4'
        };
        this.videoRef = React.createRef();
        this.canvasRef = React.createRef();
        this.backgroundRef = React.createRef();
        this.offCanvas = null;
    }

    /**
     * setState util
     * in case you need to await until state is set
     * @param {Object} newState - New state to update
     */
    asyncSetState = (newState) => {
        return new Promise(resolve => this.setState(newState, resolve));
    }

    /**
     * Call on every render frame:
     * - Estimate person mask
     * - Draw background and the person over
     */
    renderVideo = async () => {
        const { 
            model, 
            ctx, 
            videoRef, 
            canvasRef, 
            backgroundRef, 
            offCtx,
            offCanvas
        } = this;
        const background = backgroundRef.current;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const { foregroundColor, backgroundColor, height, width } = this.state;
        

        const segmentation = await model.segmentPerson(video, {
            flipHorizontal: false,
            internalResolution: 'medium',
            segmentationThreshold: 0.7
        });
        const personMasked = bodyPix.toMask(segmentation, foregroundColor, backgroundColor);
        // Draw background first if any
        if (background) {
            ctx.drawImage(background, 0, 0, width, height);
        }
        const oldGCO = offCtx.globalCompositeOperation
        // Prepare the mask, blend with webcam video
        offCtx.clearRect(0, 0, width, height);
        offCtx.putImageData(personMasked, 0, 0);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.drawImage(video, 0, 0);
        // Restore GCO
        offCtx.globalCompositeOperation = oldGCO;

        // Copy video with mask on top of background
        ctx.drawImage(offCanvas, 0, 0);

        // Next frame
        requestAnimationFrame(this.renderVideo);
    }

    /**
     * Load model and prepare webcam
     * @param {Object} options - Model options https://github.com/tensorflow/tfjs-models/tree/master/body-pix#config-params-in-bodypixload
     */
    loadModel = async (options) => {
        await this.asyncSetState({ modelReady: false });
        const model = await bodyPix.load();
        await this.asyncSetState({ modelReady: true });
        return model
    }

    /**
     * Request webcam permission
     */
    setupCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                'Browser API navigator.mediaDevices.getUserMedia not available');
        }

        const video = this.videoRef.current;
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': { facingMode: 'user' },
        });
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    }

    /**
     * Load bodyPix model, setup webcam input and canvas output
     */
    setupApp = async () => {
        const { modelOption } = this.state;
        // 1. Load model
        this.model = await this.loadModel(modelOption);

        // 2. Setup camera
        const video = await this.setupCamera();
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        video.width = videoWidth;
        video.height = videoHeight;
        video.play();

        // 3. Setup output canvas
        const canvas = this.canvasRef.current;
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d');
        this.ctx = ctx;

        // Set offCanvas size
        this.offCanvas = new OffscreenCanvas(videoWidth, videoHeight);
        this.offCtx = this.offCanvas.getContext('2d');

        this.setState({
            height: videoHeight,
            width: videoWidth
        })
        this.renderVideo();
    }

    /**
     * Handle file selector changes
     */
    handleFileChange = (evt) => {
        const { backgroundRef } = this;
        const { target: input } = evt;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const url = URL.createObjectURL(file);
            const { backgroundUrl: oldUrl } = this.state;
            const isVideo = file.type.indexOf('video') !== -1;

            // Revoke old obj url to free memory
            if (oldUrl) {
                URL.revokeObjectURL(oldUrl);
            }

            if (isVideo) {
                this.setState({
                    backgroundMode: 'video',
                    backgroundSrc: url
                }, () => {
                    backgroundRef.current.play();
                });
            } else {
                this.setState({
                    backgroundMode: 'image',
                    backgroundSrc: url
                });
            }
        }
    }

    async componentDidMount() {
        const { backgroundRef } = this;
        const { backgroundMode } = this.state;
        await this.setupApp();

        if (backgroundMode === 'video' && backgroundRef.current) {
            backgroundRef.current.play();
        }
    }

    render() {
        const { videoRef, canvasRef, backgroundRef, handleFileChange } = this;
        const { 
            modelReady,
            height, 
            width, 
            backgroundMode, 
            backgroundSrc 
        } = this.state;

        return (
            <div>
                { !modelReady ? 
                    <Loading>Please wait for model</Loading> 
                : 
                    <div className="container-fluid">
                        <div className="row">
                            <div className="webcam-source col-sm">
                                <video 
                                    playsinline 
                                    ref={ videoRef } 
                                    height={ height }
                                    width={ width }>
                                </video>
                            </div>
                            <div className="background col-sm">
                                { backgroundMode === 'image' ? 
                                    <img src={backgroundSrc} alt="background"
                                        height={ height }
                                        width={ width }
                                        ref={ backgroundRef }/> 
                                : 
                                    <video 
                                        playsinline
                                        autoplay
                                        loop
                                        muted
                                        src={backgroundSrc}
                                        height={ height }
                                        width={ width }
                                        ref={ backgroundRef }>    
                                    </video>
                                }
                                <input type="file" onChange={ handleFileChange } />
                            </div>
                        </div>
                        <div className="row">
                            <div className="output col-sm center-content">
                                <canvas 
                                    ref={ canvasRef }
                                    height={ height }
                                    width={ width }>
                                </canvas>
                            </div>
                        </div>
                    </div>
                }
            </div>
        )
    }
}