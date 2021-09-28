var softRestartQuiz = function() {
    this.currentRound = -1;
    this.doCurrentState();
}
var hardRestartQuiz = function() {
    window.location.reload();
}
var softEndRound = function(messageObject) {
    this.resetAnswers();
    this.currentRound = this.nextRound(this.currentRound);
    this.sendMessage('savePlayerState', {
        'round': (this.currentRound)
    });
    this.doCurrentState();
}
var hardEndRound = function(messageObject) {
    this.currentRound = this.nextRound(this.currentRound);
    this.sendMessage('savePlayerState', {
        'round': (this.currentRound)
    });
    window.location.reload();
}

function StandardMessageObject(label, parameterObject, sender) {
    this.label = label;
    this.parameterObject = parameterObject;
    this.sender = sender;
    return this;
}

function AnswerMessageObject(elementInstance, dataInstance) {
    this.element = elementInstance;
    this.data = dataInstance;
    return this;
}
var quizEngine = {
    quizMediator: '',
    currentQuiz: '',
    currentRound: -1,
    playerSettings: '',
    nextRound: function(currentRound) {
        var numOfRounds = this.currentQuiz.rounds.length;
        if ((currentRound >= -1) && (currentRound <= numOfRounds)) {
            currentRound++;
        } else {
            currentRound = -1;
        }
        return currentRound;
    },
    restart: function() {
        this.currentRound = -1;
        this.doCurrentState();
    },
    doCurrentState: function() {
        var outcome;
        var score;
        var allOutcomes = this.currentQuiz.outcomes;

        function calcFinalOutcome_callback(outcomeObject) {
            var messageObject = {};
            this.outcome = outcomeObject;
            messageObject.quizTitle = this.currentQuiz.meta.title;
            messageObject.winner = outcomeObject.winningOutcome;
            messageObject.all = this.currentQuiz.outcomes;
            messageObject.outcomes = this.currentQuiz.highScores.outcomes;
            messageObject.related = this.currentQuiz.related;
            this.sendMessage('doOutcome', messageObject);
            this.sendMessage('setOutcome', messageObject.winner);
            this.sendMessage('setAnswerHistory', outcomeObject.answerHistory);
            this.sendMessage('updateStats', messageObject.winner);
            this.sendMessage('clearPlayerState', {});
        }

        function calcFinalScore_callback(scoreObject) {
            this.score = scoreObject;
            scoreObject.quizTitle = this.currentQuiz.meta.title;
            scoreObject.numOfRounds = this.currentQuiz.rounds.length;
            scoreObject.highScores = this.currentQuiz.highScores;
            scoreObject.winningOutcome = this.currentQuiz.outcomes[0];
            scoreObject.related = this.currentQuiz.related;
            this.sendMessage('doScorecard', scoreObject);
            this.sendMessage('setFinalScore', scoreObject);
            this.sendMessage('setAnswerHistory', scoreObject.answerHistory);
            this.sendMessage('updateStats', scoreObject.winner);
            this.sendMessage('clearPlayerState', {});
        }
        if (this.currentRound == -1) {
            this.sendMessage('doCover', this.currentQuiz.meta)
        } else if (this.currentRound >= this.currentQuiz.rounds.length) {
            if (this.currentQuiz.meta.isGraded == true) {
                this.sendMessage('calculateFinalScore', {
                    'callback': calcFinalScore_callback
                });
            } else {
                this.sendMessage('calculateFinalOutcome', {
                    'callback': calcFinalOutcome_callback,
                    'allOutcomes': allOutcomes
                });
            }
        } else {
            var myObject = {};
            myObject.isGraded = this.currentQuiz.meta.isGraded;
            myObject.currentRound = this.currentQuiz.rounds[this.currentRound];
            myObject.currentRoundNumber = this.currentRound;
            myObject.totalRounds = this.currentQuiz.rounds.length;
            this.sendMessage('doRound', myObject);
        }
    },
    preEndRound: function(stdMessageObject) {
        stdMessageObject.parameterObject.callback.call();
        if ((this.currentRound >= 0) && (this.currentRound < this.currentQuiz.rounds.length)) {
            if (this.currentQuiz.meta.isGraded == true) {
                this.sendMessage('calculateScore', this.currentQuiz.rounds[this.currentRound]);
            } else {
                this.sendMessage('calculateOutcome', this.currentQuiz.rounds[this.currentRound]);
            }
        }
    },
    endRound: function(messageObject) {
        this.resetAnswers();
        this.currentRound = this.nextRound(this.currentRound);
        this.sendMessage('savePlayerState', {
            'round': (this.currentRound)
        });
        this.doCurrentState();
    },
    resetAnswers: function() {
        if (this.currentQuiz.rounds[this.currentRound]) {
            var allPossibleAnswers = this.currentQuiz.rounds[this.currentRound].answers;
            var counter = 0;
            var numOfAnswers = allPossibleAnswers.length;
            for (counter = 0; counter < numOfAnswers; counter++) {
                if (allPossibleAnswers[counter].selected == true) {
                    allPossibleAnswers[counter].selected = false;
                }
            }
        }
    },
    goNextRound: function() {
        this.currentRound = this.nextRound(this.currentRound);
        this.sendMessage('savePlayerState', {
            'round': (this.currentRound)
        });
        this.doCurrentState();
    },
    updatePlayerState: function(playerStateObject) {
        this.currentRound = playerStateObject.round;
    },
    doSingleAnswer: function(stdMessageObject) {
        var answerMessageObject = stdMessageObject.parameterObject;
        if (answerMessageObject.data.selected == true) {
            this.resetAnswers();
            answerMessageObject.data.selected = false;
        } else {
            this.resetAnswers();
            answerMessageObject.data.selected = true;
        }
    },
    doMultiAnswer: function(stdMessageObject) {
        var answerMessageObject = stdMessageObject.parameterObject;
        if (answerMessageObject.data.selected == true) {
            answerMessageObject.data.selected = false;
        } else {
            answerMessageObject.data.selected = true;
        }
    },
    acceptMessage: function(stdMessageObject) {
        switch (stdMessageObject.label) {
            case 'preEndRound':
            case 'confirmAnswer':
                this.preEndRound(stdMessageObject);
                break;
            case 'indicateSingleAnswer':
                this.doSingleAnswer(stdMessageObject);
                break;
            case 'indicateMultiAnswer':
                this.doMultiAnswer(stdMessageObject);
                break;
            case 'restartQuiz':
                this.restart();
                break;
            case 'endRound':
                this.endRound(stdMessageObject);
                break;
            case 'nextRound':
                this.nextRound(this.currentRound);
                this.doCurrentState();
                break;
            default:
                break;
        }
    },
    sendMessage: function(label, object) {
        var message = new StandardMessageObject(label, object, quizEngine);
        this.quizMediator.acceptMessage(message);
    },
    init: function(mediator, quizData) {
        this.quizMediator = mediator;
        this.currentQuiz = quizData;
        this.sendMessage('loadPlayerState', {
            callback: this.updatePlayerState.bind(this)
        });
    }
};
var quizRenderer = {
    quizMediator: '',
    quizWrapperElement: '',
    resetAnswers: function() {
        var allAnswers = document.querySelectorAll('.possibleResponse');
        var counter = 0;
        var numOf = allAnswers.length;
        for (counter = 0; counter < numOf; counter++) {
            allAnswers[counter].classList.remove('button_active');
            allAnswers[counter].dataset.isSelected = 'false';
        }
    },
    createQuizButton: function(text) {
        var button = document.createElement('div');
        button.classList.add('quizButton');
        button.innerText = text;
        return button;
    },
    clearSlide: function() {
        this.quizWrapperElement.innerHTML = '';
    },
    createStatusBar: function(percentageAsInt, textToDisplay, statusBarClass) {
        var wrapperElement = document.createElement('div');
        wrapperElement.setAttribute('id', statusBarClass);
        wrapperElement.classList.add('status');
        wrapperElement.classList.add(statusBarClass);
        var backgroundElement = document.createElement('div');
        backgroundElement.classList.add('status_background');
        var foregroundElement = document.createElement('div');
        foregroundElement.classList.add('status_foreground');
        var text = document.createElement('span');
        text.classList.add('status_text');
        text.innerText = textToDisplay;
        window.setTimeout(function() {
            foregroundElement.style.width = percentageAsInt + '%';
            if ((percentageAsInt + '%').length >= 4) {
                text.parentNode.removeChild(text);
                text.classList.remove('status_text');
                foregroundElement.addEventListener('transitionend', function() {
                    text.innerText = 'Perfect!';
                    text.classList.add('status_text_perfect');
                    foregroundElement.appendChild(text);
                    foregroundElement.style.textAlign = 'center';
                    window.setTimeout(function() {
                        text.style.opacity = 1;
                    }, 300);
                });
            }
        }, 500);
        backgroundElement.appendChild(foregroundElement);
        backgroundElement.appendChild(text);
        wrapperElement.appendChild(backgroundElement);
        return wrapperElement;
    },
    getAverageScore: function(highScoresObject) {
        var total = 0;
        var average;
        total += highScoresObject.chunk_0;
        total += highScoresObject.chunk_1;
        total += highScoresObject.chunk_2;
        total += highScoresObject.chunk_3;
        average = Math.round(((12 * highScoresObject.chunk_0) + (37.5 * highScoresObject.chunk_1) + (62.5 * highScoresObject.chunk_2) + (87.5 * highScoresObject.chunk_3)) / total);
        return average;
    },
    createRelatedQuizSection: function(relatedQuizArray) {
        var counter = 0;
        var numOf = relatedQuizArray.length;
        var wrapperElem = document.createElement('div');
        wrapperElem.classList.add('relatedQuizWrapper');
        var headerElem = document.createElement('h4');
        var quiz_wrapperElem;
        var quiz_linkElem;
        var quiz_imageElem;
        var quiz_excerptElem;
        if (numOf > 3) {
            for (counter = 0; counter < numOf; counter++) {
                quiz_wrapperElem = document.createElement('div');
                quiz_wrapperElem.classList.add('relatedquizOne');
                quiz_linkElem = document.createElement('a');
                quiz_linkElem.addEventListener('click', this.sendMessage.bind(quizRenderer, 'doRelatedQuiz', {}));
                quiz_linkElem.setAttribute('href', relatedQuizArray[counter].url);
                quiz_imageElem = document.createElement('img');
                quiz_imageElem.classList.add('relatedquizoneImage');
                quiz_imageElem.setAttribute('src', relatedQuizArray[counter].image);
                quiz_excerptElem = document.createElement('p');
                quiz_excerptElem.classList.add('relatedquizText');
                quiz_excerptElem.innerText = relatedQuizArray[counter].title;
                quiz_linkElem.appendChild(quiz_imageElem);
                quiz_linkElem.appendChild(quiz_excerptElem);
                quiz_wrapperElem.appendChild(quiz_linkElem);
                wrapperElem.appendChild(quiz_wrapperElem);
            }
        }
        return wrapperElem;
    },
    createSocialShareSection: function(sectionHeaderText, resultInfo) {
        var socialSectionElem = document.createElement('div');
        socialSectionElem.classList.add('socialshareSection');
        var socialHeaderElem = document.createElement('h4');
        socialHeaderElem.classList.add('socialshareHeader');
        socialHeaderElem.innerText = sectionHeaderText;

        function PostToFacebook() {
            FB.ui({
                method: 'share',
                href: window.location.href,
                quote: resultInfo.title + " Take CI's quiz, '" + resultInfo.quizTitle + "', and find out where YOU stand! "
            }, function(response) {});
        }
        var facebookElem = document.createElement('div');
        facebookElem.classList.add('socialshareFacebook');
        var facebookElem_link = document.createElement('a');
        facebookElem_link.setAttribute('href', '#');
        facebookElem_link.addEventListener('click', this.sendMessage.bind(quizRenderer, 'shareQuiz', {
            'network': 'facebook'
        }));
        facebookElem_link.addEventListener('click', PostToFacebook);
        var facebookElem_image = document.createElement('img');
        facebookElem_image.classList.add('socialshareFacebookImage');
        facebookElem_image.setAttribute('src', 'http://www.commercialintegrator.com/wp-content/themes/commintegrator/assets/quiz/socialIcons/sm_fb_tile.png');
        var facebookElem_text = document.createElement('span');
        facebookElem_text.classList.add('socialshareText');
        facebookElem_text.innerText = 'Facebook';
        facebookElem_link.appendChild(facebookElem_image);
        facebookElem_link.appendChild(facebookElem_text);
        facebookElem.appendChild(facebookElem_link);
        var twitterUrl = "http://twitter.com/share?url=" + encodeURIComponent(window.location.href) + "&text=" + encodeURIComponent(resultInfo.title) + encodeURIComponent(' Take CI\'s quiz, "' + resultInfo.quizTitle + '", and find out where YOU stand!') + "&via=commintegrator";
        var twitterElem = document.createElement('div');
        twitterElem.classList.add('socialshareTwitter');
        var twitterElem_link = document.createElement('a');
        twitterElem_link.setAttribute('href', twitterUrl);
        twitterElem_link.addEventListener('click', this.sendMessage.bind(quizRenderer, 'shareQuiz', {
            'network': 'twitter'
        }));
        var twitterElem_image = document.createElement('img');
        twitterElem_image.classList.add('socialshareTwitterImage');
        twitterElem_image.setAttribute('src', 'http://www.commercialintegrator.com/wp-content/themes/commintegrator/assets/quiz/socialIcons/sm_tw_tile.png');
        var twitterElem_text = document.createElement('span');
        twitterElem_text.classList.add('socialshareText');
        twitterElem_text.innerText = 'Twitter';
        twitterElem_link.appendChild(twitterElem_image);
        twitterElem_link.appendChild(twitterElem_text);
        twitterElem.appendChild(twitterElem_link);
        var linkedInUrl = "http://www.linkedin.com/shareArticle?url=" + encodeURIComponent(window.location.href) + "&title=" + encodeURIComponent(resultInfo.title) + "&summary=" + encodeURIComponent(' Take CI\'s quiz, "' + resultInfo.quizTitle + '", and find out where YOU stand!') + "&mini=true";
        var linkedinElem = document.createElement('div');
        linkedinElem.classList.add('socialshareLinkedin');
        var linkedinElem_link = document.createElement('a');
        linkedinElem_link.setAttribute('href', linkedInUrl);
        linkedinElem_link.addEventListener('click', this.sendMessage.bind(quizRenderer, 'shareQuiz', {
            'network': 'linkedin'
        }));
        var linkedinElem_image = document.createElement('img');
        linkedinElem_image.classList.add('socialshareLinkedinImage');
        linkedinElem_image.setAttribute('src', 'http://www.commercialintegrator.com/wp-content/themes/commintegrator/assets/quiz/socialIcons/sm_li_tile.png');
        var linkedinElem_text = document.createElement('span');
        linkedinElem_text.classList.add('socialshareText');
        linkedinElem_text.innerText = 'LinkedIn';
        linkedinElem_link.appendChild(linkedinElem_image);
        linkedinElem_link.appendChild(linkedinElem_text);
        linkedinElem.appendChild(linkedinElem_link);
        socialSectionElem.appendChild(socialHeaderElem);
        socialSectionElem.appendChild(facebookElem);
        socialSectionElem.appendChild(twitterElem);
        socialSectionElem.appendChild(linkedinElem);
        return socialSectionElem;
    },
    createResetQuizSection: function() {
        var restartButton = this.createQuizButton('Retake This Quiz');
        restartButton.classList.add('quizButton');
        restartButton.classList.add('nextRoundButton');
        restartButton.dataset.enabled = 'true';
        restartButton.addEventListener('click', this.sendMessage.bind(quizRenderer, 'restartQuiz', {}));
        var restartButtonWrapper = document.createElement('div');
        restartButtonWrapper.classList.add('nextRoundButtonWrapper');
        restartButtonWrapper.appendChild(restartButton);
        return restartButtonWrapper;
    },
    renderCover: function(stdMessageObject) {
        var quizMeta = stdMessageObject.parameterObject;
        var titleElem;
        var contentWrapper;
        var descElem;
        var imgElem;
        var imgWrapperElem;
        var startButton;
        var buttonWrapperElem;
        this.clearSlide();
        this.quizWrapperElement.dataset.state = 'cover';
        titleElem = document.createElement('h2');
        titleElem.innerText = quizMeta.title;
        titleElem.classList.add('title');
        contentWrapper = document.createElement('div');
        contentWrapper.classList.add('contentWrapper');
        descElem = document.createElement('div');
        quizMeta.description = quizMeta.description.replace(/&apos;/g, "'");
        descElem.innerText = quizMeta.description;
        descElem.classList.add('description');
        imgElem = document.createElement('img');
        imgElem.setAttribute('src', quizMeta.image);
        imgElem.classList.add('image');
        imgWrapperElem = document.createElement('div');
        imgWrapperElem.appendChild(imgElem);
        imgWrapperElem.classList.add('imageWrapper');
        startButton = this.createQuizButton('START QUIZ');
        startButton.classList.add('nextRoundButton');
        startButton.dataset.enabled = 'true';
        startButton.addEventListener('click', this.sendMessage.bind(quizRenderer, 'startQuiz', {}));
        startButton.addEventListener('click', this.sendMessage.bind(quizRenderer, 'endRound', {}));
        buttonWrapperElem = document.createElement('div');
        buttonWrapperElem.classList.add('answerWrapper');
        buttonWrapperElem.appendChild(startButton);
        if (quizMeta.title) {
            this.quizWrapperElement.appendChild(titleElem);
        }
        this.quizWrapperElement.appendChild(contentWrapper);
        if (quizMeta.image) {
            contentWrapper.appendChild(imgWrapperElem);
        }
        if (quizMeta.description) {
            contentWrapper.appendChild(descElem);
        }
        contentWrapper.appendChild(buttonWrapperElem);
        this.sendMessage('quizImpression', {})
    },
    renderSlide: function(stdMessageObject) {
        var titleElem;
        var contentWrapper;
        var descElem;
        var explanationElem;
        var imgElem;
        var imgWrapperElem;
        var answerWrapperElem;
        var nextRoundButtonElem;
        var nextRoundButtonWrapperElem;
        var slideOfSlidesElem;
        var rightOrWrongElem
        var quizWrapper = this.quizWrapperElement;
        var round = stdMessageObject.parameterObject.currentRound;
        var roundNum = stdMessageObject.parameterObject.currentRoundNumber + 1;
        var roundTotalNum = stdMessageObject.parameterObject.totalRounds;
        var roundIsGraded = stdMessageObject.parameterObject.isGraded;
        var counter = 0;
        var numOf = round.answers.length;
        var thisAnswerElem;
        var answerObject;
        var clickListener_indicate;
        var clickListener_updateSlide;
        quizWrapper.dataset.state = 'pre_slide';
        this.clearSlide();

        function UpdateSlide() {
            quizWrapper.dataset.state = 'post_slide';
            var playerIsCorrect = false;
            var allAnswerButtons = document.querySelectorAll('#zw_quiz_answerWrapper .possibleResponse');
            var counter = 0;
            var numOf = allAnswerButtons.length;
            for (counter = 0; counter < numOf; counter++) {
                allAnswerButtons[counter].dataset.enabled = 'false';
                if (roundIsGraded == true) {
                    if (round.roundType == 'multiple') {
                        if (allAnswerButtons[counter].dataset.isSelected == 'true') {
                            if (allAnswerButtons[counter].dataset.isCorrect == 'false') {
                                allAnswerButtons[counter].classList.add('quizButton_incorrect')
                            } else if (allAnswerButtons[counter].dataset.isCorrect == 'true') {
                                allAnswerButtons[counter].classList.add('quizButton_correct')
                            } else {
                                allAnswerButtons[counter].classList.add('quizButton_multi')
                            }
                        }
                    } else {
                        if (allAnswerButtons[counter].dataset.isSelected == 'true') {
                            if (allAnswerButtons[counter].dataset.isCorrect == 'false') {
                                allAnswerButtons[counter].classList.add('quizButton_incorrect')
                            } else if (allAnswerButtons[counter].dataset.isCorrect == 'true') {
                                allAnswerButtons[counter].classList.add('quizButton_correct')
                            } else {
                                allAnswerButtons[counter].classList.add('quizButton_single')
                            }
                        }
                    }
                }
                allAnswerButtons[counter].removeEventListener('click', allAnswerClickListeners[counter]);
            }
            if (round.roundType == 'multiple') {
                counter = 0;
                playerIsCorrect = true;
                numOf = allAnswerButtons.length;
                for (counter = 0; counter < numOf; counter++) {
                    if (allAnswerButtons[counter].dataset.isSelected == 'true') {
                        if (allAnswerButtons[counter].dataset.isCorrect == 'false') {
                            playerIsCorrect = false;
                            break;
                        }
                    } else {
                        if (allAnswerButtons[counter].dataset.isCorrect == 'true') {
                            playerIsCorrect = false;
                            break;
                        }
                    }
                }
            } else {
                counter = 0;
                numOf = allAnswerButtons.length;
                for (counter = 0; counter < numOf; counter++) {
                    if (allAnswerButtons[counter].dataset.isSelected == 'true') {
                        if (allAnswerButtons[counter].dataset.isCorrect == 'true') {
                            playerIsCorrect = true;
                            break;
                        }
                    }
                }
            }
            if (roundIsGraded == true) {
                if (playerIsCorrect == true) {
                    rightOrWrongElem.innerText = 'Great job!';
                } else {
                    rightOrWrongElem.innerText = 'Oops!';
                }
            }
            if (round.explanation) {
                explanationElem.innerHTML = round.explanation;
            }
            nextRoundButtonElem.removeEventListener('click', confirmAnswerClickListener);
            nextRoundButtonElem.addEventListener('click', endRoundClickListener);
            nextRoundButtonElem.innerText = 'NEXT >';
        }
        var UpdateSlideCallback = UpdateSlide.bind(quizRenderer);
        var confirmAnswerClickListener = this.sendMessage.bind(quizRenderer, 'confirmAnswer', {
            callback: UpdateSlideCallback
        });
        var endRoundClickListener = this.sendMessage.bind(quizRenderer, 'endRound', {});
        var allAnswerClickListeners = [];
        contentWrapper = document.createElement('div');
        contentWrapper.classList.add('contentWrapper');
        titleElem = document.createElement('h2');
        titleElem.innerText = round.title;
        titleElem.classList.add('title');
        if (round.description) {
            descElem = document.createElement('div');
            round.description = round.description.replace(/&apos;/g, "'");
            descElem.innerText = round.description;
            descElem.classList.add('description');
        }
        if (round.explanation) {
            round.explanation = round.explanation.replace(/&apos;/g, "'");
            explanationElem = document.createElement('div');
            explanationElem.classList.add('explanation');
        }
        if (round.image) {
            imgElem = document.createElement('img');
            imgElem.setAttribute('src', round.image);
            imgElem.classList.add('image');
            imgWrapperElem = document.createElement('div');
            imgWrapperElem.classList.add('imageWrapper');
            imgWrapperElem.appendChild(imgElem);
        }
        answerWrapperElem = document.createElement('div');
        answerWrapperElem.classList.add('answerWrapper');
        answerWrapperElem.setAttribute('id', 'zw_quiz_answerWrapper');
        nextRoundButtonElem = this.createQuizButton('SUBMIT ANSWER >');
        nextRoundButtonElem.classList.add('nextRoundButton');
        nextRoundButtonElem.dataset.enabled = 'true';
        nextRoundButtonElem.addEventListener('click', confirmAnswerClickListener);
        nextRoundButtonWrapperElem = document.createElement('div');
        nextRoundButtonWrapperElem.classList.add('nextRoundButtonWrapper');
        nextRoundButtonWrapperElem.appendChild(nextRoundButtonElem);
        slideOfSlidesElem = document.createElement('div');
        slideOfSlidesElem.classList.add('quizProgress');
        slideOfSlidesElem.innerText = roundNum + ' of ' + roundTotalNum;
        rightOrWrongElem = document.createElement('div');
        rightOrWrongElem.classList.add('rightWrongStatus');
        for (counter = 0; counter < numOf; counter++) {
            thisAnswerElem = this.createQuizButton(round.answers[counter].text);
            thisAnswerElem.classList.add('possibleResponse');
            thisAnswerElem.dataset.isCorrect = round.answers[counter].isCorrect;
            thisAnswerElem.dataset.enabled = 'true';
            answerWrapperElem.appendChild(thisAnswerElem);
            answerObject = new AnswerMessageObject(thisAnswerElem, round.answers[counter]);
            if (round.roundType == 'multiple') {
                allAnswerClickListeners[counter] = this.sendMessage.bind(quizRenderer, 'indicateMultiAnswer', answerObject);
            } else {
                allAnswerClickListeners[counter] = this.sendMessage.bind(quizRenderer, 'indicateSingleAnswer', answerObject);
            }
            thisAnswerElem.addEventListener('click', allAnswerClickListeners[counter]);
        }
        this.quizWrapperElement.appendChild(titleElem);
        this.quizWrapperElement.appendChild(contentWrapper);
        contentWrapper.appendChild(slideOfSlidesElem);
        if (round.description) {
            contentWrapper.appendChild(descElem);
        }
        if (round.image) {
            contentWrapper.appendChild(imgWrapperElem);
        }
        contentWrapper.appendChild(answerWrapperElem);
        contentWrapper.appendChild(rightOrWrongElem);
        if (round.explanation) {
            contentWrapper.appendChild(explanationElem);
        }
        contentWrapper.appendChild(nextRoundButtonWrapperElem);
    },
    renderOutcome: function(stdMessageObject) {
        var counter = 0;
        var outcome = stdMessageObject.parameterObject.winner;
        var allOutcomes = stdMessageObject.parameterObject.all;
        var outcomeScores = stdMessageObject.parameterObject.outcomes;
        var totalOutcomesEverAssigned = 0;
        var titleElem;
        var contentWrapper;
        var descElem;
        var imgElem;
        var imgWrapperElem;
        var restartButtonWrapper;
        var relatedQuizSection;
        var socialShareSection;
        this.clearSlide();
        this.quizWrapperElement.dataset.state = 'outcome';
        outcome.title = outcome.title.replace(/&apos;/g, "'");
        titleElem = document.createElement('h2');
        titleElem.innerText = outcome.title;
        titleElem.classList.add('title');
        contentWrapper = document.createElement('div');
        contentWrapper.classList.add('contentWrapper');
        if (outcome.description) {
            descElem = document.createElement('div');
            outcome.description = outcome.description.replace(/&apos;/g, "'");
            descElem.innerHTML = outcome.description;
            descElem.classList.add('description');
        }
        if (outcome.image) {
            imgElem = document.createElement('img');
            imgElem.setAttribute('src', outcome.image);
            imgElem.classList.add('image');
            imgWrapperElem = document.createElement('div');
            imgWrapperElem.classList.add('imageWrapper');
            imgWrapperElem.appendChild(imgElem);
        }
        restartButtonWrapper = this.createResetQuizSection();
        relatedQuizSection = this.createRelatedQuizSection(stdMessageObject.parameterObject.related);
        socialShareSection = this.createSocialShareSection('See How Your Friends Match Up!', {
            'quizTitle': stdMessageObject.parameterObject.quizTitle,
            'title': outcome.title,
            'image': outcome.image
        });
        this.quizWrapperElement.appendChild(titleElem);
        this.quizWrapperElement.appendChild(contentWrapper);
        if (outcome.image) {
            contentWrapper.appendChild(imgWrapperElem);
        }
        if (outcome.description) {
            contentWrapper.appendChild(descElem);
        }
        contentWrapper.appendChild(relatedQuizSection);
        contentWrapper.appendChild(socialShareSection);
        contentWrapper.appendChild(restartButtonWrapper);
        this.sendMessage('endQuiz', {})
    },
    renderScorecard: function(scoreObject) {
        var contentWrapper;
        var titleElem;
        var imgElem;
        var imgWrapperElem;
        var yourscoreheaderElem;
        var statusBar;
        var averagescoreheaderElem;
        var statusBar2;
        var descriptionElem;
        var relatedQuizSection;
        var socialShareSection;
        var restartButtonWrapper;
        var scorePercentage = Math.round((scoreObject.parameterObject.score / scoreObject.parameterObject.total * 100));
        var avgPercentage = this.getAverageScore(scoreObject.parameterObject.highScores);
        this.clearSlide();
        this.quizWrapperElement.dataset.state = 'outcome';
        contentWrapper = document.createElement('div');
        contentWrapper.classList.add('contentWrapper');
        titleElem = document.createElement('h2');
        titleElem.innerText = 'You Scored: ' + scoreObject.parameterObject.score + ' out of ' + scoreObject.parameterObject.total + '!';
        titleElem.classList.add('title');
        if (scoreObject.parameterObject.winningOutcome.image) {
            imgElem = document.createElement('img');
            imgElem.setAttribute('src', scoreObject.parameterObject.winningOutcome.image);
            imgElem.classList.add('image');
            imgWrapperElem = document.createElement('div');
            imgWrapperElem.classList.add('imageWrapper');
            imgWrapperElem.appendChild(imgElem);
        }
        yourscoreheaderElem = document.createElement('div');
        yourscoreheaderElem.classList.add('yourscoreHeader');
        yourscoreheaderElem.innerText = 'Your Score';
        statusBar = this.createStatusBar(scorePercentage, scorePercentage + "%", 'generic');
        statusBar.style.display = 'block';
        averagescoreheaderElem = document.createElement('div');
        averagescoreheaderElem.classList.add('averagescoreHeader');
        averagescoreheaderElem.innerText = 'Average Score';
        statusBar2 = this.createStatusBar(avgPercentage, avgPercentage + '%', 'status_average');
        statusBar2.style.display = 'block';
        if (scoreObject.parameterObject.winningOutcome.description) {
            descriptionElem = document.createElement('div');
            descriptionElem.innerHTML = scoreObject.parameterObject.winningOutcome.description;
            descriptionElem.innerHTML = descriptionElem.innerHTML.replace(/&apos;/g, "'");
            descriptionElem.classList.add('description');
        }
        relatedQuizSection = this.createRelatedQuizSection(scoreObject.parameterObject.related);
        socialShareSection = this.createSocialShareSection('Challenge Your Friends to Beat Your Score!', {
            'quizTitle': scoreObject.parameterObject.quizTitle,
            'title': 'I scored ' + scorePercentage + '%!',
            'image': scoreObject.parameterObject.winningOutcome.image
        });
        restartButtonWrapper = this.createResetQuizSection();
        this.quizWrapperElement.appendChild(titleElem);
        this.quizWrapperElement.appendChild(contentWrapper);
        contentWrapper.appendChild(yourscoreheaderElem);
        contentWrapper.appendChild(statusBar);
        contentWrapper.appendChild(averagescoreheaderElem);
        contentWrapper.appendChild(statusBar2);
        if (scoreObject.parameterObject.winningOutcome.image) {
            contentWrapper.appendChild(imgWrapperElem);
        }
        if (scoreObject.parameterObject.winningOutcome.description) {
            contentWrapper.appendChild(descriptionElem);
        }
        contentWrapper.appendChild(relatedQuizSection);
        contentWrapper.appendChild(socialShareSection);
        contentWrapper.appendChild(restartButtonWrapper);
        this.sendMessage('endQuiz', {})
    },
    indicateSingleAnswer: function(stdMessageObject) {
        var answerMessageObject = stdMessageObject.parameterObject;
        var buttonElement = answerMessageObject.element;
        this.resetAnswers();
        buttonElement.classList.toggle('button_active');
        if (buttonElement.dataset.isSelected == 'true') {
            buttonElement.dataset.isSelected = 'false';
        } else {
            buttonElement.dataset.isSelected = 'true';
        }
    },
    indicateMultiAnswer: function(stdMessageObject) {
        var answerMessageObject = stdMessageObject.parameterObject;
        var buttonElement = answerMessageObject.element;
        buttonElement.classList.toggle('button_active');
        if (buttonElement.dataset.isSelected == 'true') {
            buttonElement.dataset.isSelected = 'false';
        } else {
            buttonElement.dataset.isSelected = 'true';
        }
    },
    acceptMessage: function(stdMessageObject) {
        switch (stdMessageObject.label) {
            case 'doCover':
                this.renderCover(stdMessageObject);
                break;
            case 'doOutcome':
                this.renderOutcome(stdMessageObject);
                break;
            case 'doScorecard':
                this.renderScorecard(stdMessageObject);
                break;
            case 'doRound':
                this.renderSlide.call(quizRenderer, stdMessageObject);
                break;
            case 'indicateSingleAnswer':
                this.indicateSingleAnswer(stdMessageObject);
                break;
            case 'indicateMultiAnswer':
                this.indicateMultiAnswer(stdMessageObject);
                break;
            default:
                break;
        }
    },
    sendMessage: function(label, object) {
        var message = new StandardMessageObject(label, object, quizRenderer);
        this.quizMediator.acceptMessage(message);
    },
    init: function(mediator, quizWrapperElement) {
        this.quizMediator = mediator;
        this.quizWrapperElement = quizWrapperElement;
    }
};
var quizMediator = {
    allReceivers: [],
    acceptMessage: function(stdMessageObject) {
        var counter = 0;
        var numOf = this.allReceivers.length;
        for (counter = 0; counter < numOf; counter++) {
            try {
                this.allReceivers[counter].acceptMessage.call(this.allReceivers[counter], stdMessageObject);
            } catch (error) {}
        }
    },
    init: function(arrayOfObjectsToRegister) {
        var counter = 0;
        var numOf = arrayOfObjectsToRegister.length;
        for (counter = 0; counter < numOf; counter++) {
            this.allReceivers.push(arrayOfObjectsToRegister[counter]);
        }
    }
};
var quizPlayer = {
    quizMediator: '',
    answerTally: {},
    answerHistory: {},
    getScoredOutcome: function(stdMessageObject) {
        var finalScore;
        if ((typeof this.answerTally['score'] !== 'undefined') && (typeof this.answerTally['total'] !== 'undefined')) {
            finalScore = {
                'score': this.answerTally['score'],
                'total': this.answerTally['total'],
                'answerHistory': this.answerHistory
            };
            stdMessageObject.parameterObject.callback.call(stdMessageObject.sender, finalScore);
        }
    },
    scoreAnswers: function(stdMessageObject) {
        var currentRound = stdMessageObject.parameterObject;
        var counter = 0;
        var numOf = currentRound.answers.length;
        if (typeof this.answerTally['score'] == 'undefined') {
            this.answerTally['score'] = 0;
        }
        if (typeof this.answerTally['total'] == 'undefined') {
            this.answerTally['total'] = 0;
        }
        for (counter = 0; counter < numOf; counter++) {
            if ((currentRound.answers[counter].selected == true) && (currentRound.answers[counter].isCorrect == true)) {
                this.answerTally['score']++;
            }
            if (currentRound.answers[counter].isCorrect == true) {
                this.answerTally['total']++;
            }
            if (currentRound.answers[counter].selected == true) {
                if (this.answerHistory[currentRound.slug]) {
                    this.answerHistory[currentRound.slug].push(currentRound.answers[counter].slug);
                } else {
                    this.answerHistory[currentRound.slug] = [currentRound.answers[counter].slug];
                }
            }
        }
    },
    getHighestOutcome: function(stdMessageObject) {
        var allOutcomes = stdMessageObject.parameterObject.allOutcomes;
        var counter = 0;
        var numOfOutcomes = allOutcomes.length;
        var responseObject = {};
        var winningOutcome = allOutcomes[0];
        var highestScore = -1;
        for (counter = 0; counter < numOfOutcomes; counter++) {
            if (this.answerTally[allOutcomes[counter].slug]) {
                if (this.answerTally[allOutcomes[counter].slug] > highestScore) {
                    winningOutcome = allOutcomes[counter];
                    highestScore = this.answerTally[allOutcomes[counter].slug];
                }
            }
        }
        responseObject.answerHistory = this.answerHistory;
        responseObject.winningOutcome = winningOutcome;
        stdMessageObject.parameterObject.callback.call(stdMessageObject.sender, responseObject);
    },
    scoreOutcomes: function(stdMessageObject) {
        var currentRound = stdMessageObject.parameterObject;
        var counter = 0;
        var numOf = currentRound.answers.length;
        for (counter = 0; counter < numOf; counter++) {
            if (currentRound.answers[counter].selected == true) {
                this.addOutcomeAnswer(currentRound.answers[counter]);
                if (this.answerHistory[currentRound.slug]) {
                    this.answerHistory[currentRound.slug].push(currentRound.answers[counter].slug);
                } else {
                    this.answerHistory[currentRound.slug] = [currentRound.answers[counter].slug];
                }
            }
        }
    },
    addOutcomeAnswer: function(submittedAnswer) {
        var answerCounter = 0;
        var numOfAnswerMappings = submittedAnswer.outcomeMapping.length;
        for (answerCounter = 0; answerCounter < numOfAnswerMappings; answerCounter++) {
            if (this.answerTally[submittedAnswer.outcomeMapping[answerCounter]]) {
                this.answerTally[submittedAnswer.outcomeMapping[answerCounter]]++;
            } else {
                this.answerTally[submittedAnswer.outcomeMapping[answerCounter]] = 1;
            }
        }
    },
    savePlayerState: function(stdMessageObject) {
        var savedData = {
            'tally': this.answerTally,
            'answerHistory': this.answerHistory,
            'round': stdMessageObject.parameterObject.round
        };
        savedData = JSON.stringify(savedData);
        SetCookie('quiz_' + zw_ajax.post_id, savedData);
    },
    loadPlayerState: function(messageObject) {
        var savedData = GetCookie('quiz_' + zw_ajax.post_id);
        if (savedData) {
            savedData = JSON.parse(savedData);
            this.answerTally = savedData.tally;
            this.answerHistory = savedData.answerHistory, messageObject.parameterObject.callback.call(messageObject.sender, savedData);
        }
    },
    clearPlayerData: function() {
        DeleteCookie('quiz_' + zw_ajax.post_id);
        this.answerTally = {};
        this.answerHistory = {};
    },
    acceptMessage: function(stdMessageObject) {
        switch (stdMessageObject.label) {
            case 'savePlayerState':
                this.savePlayerState(stdMessageObject);
                break;
            case 'loadPlayerState':
                this.loadPlayerState(stdMessageObject);
                break;
            case 'clearPlayerState':
            case 'restartQuiz':
                this.clearPlayerData();
                break;
            case 'calculateOutcome':
                this.scoreOutcomes(stdMessageObject);
                break;
            case 'calculateScore':
                this.scoreAnswers(stdMessageObject);
                break;
            case 'calculateFinalOutcome':
                this.getHighestOutcome(stdMessageObject);
                break;
            case 'calculateFinalScore':
                this.getScoredOutcome(stdMessageObject);
                break;
            default:
                break;
        }
    }
};
var quizEventTracker = {
    acceptMessage: function(stdMessageObject) {
        switch (stdMessageObject.label) {
            case 'quizImpression':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'impression',
                    nonInteraction: true
                });
                break;
            case 'startQuiz':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'begin'
                });
                break;
            case 'endQuiz':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'finish'
                });
                break;
            case 'restartQuiz':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'restart'
                });
                break;
            case 'shareQuiz':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'share'
                });
                break;
            case 'doRelatedQuiz':
                ga('send', {
                    hitType: 'event',
                    eventCategory: 'quiz',
                    eventAction: 'relatedClick'
                });
                break;
            default:
                break;
        }
    }
};
var DataInteractor = {
    winningOutcome: '',
    finalScore: {
        'correct': 0,
        'total': 0
    },
    answerHistory: '',
    postToServer: function() {
        var answerHistory = JSON.stringify(this.answerHistory);
        var postId = zw_ajax.post_id;
        var winningOutcome;
        var quizType = 'unknown';
        if (this.winningOutcome !== '') {
            quizType = 'outcome';
            winningOutcome = this.winningOutcome;
        } else if (this.finalScore.total !== 0) {
            quizType = 'scored';
            winningOutcome = Math.round((this.finalScore.correct / this.finalScore.total) * 100);
        }
        var testData = {};
        testData.action = 'updateQuizStats';
        testData.outcome = winningOutcome;
        testData.nonce = zw_ajax.ajax_nonce;
        testData.post_id = postId;
        testData.answerTally = answerHistory;
        testData.quizType = quizType;
        jQuery.ajax({
            'url': zw_ajax.ajax_url,
            'type': 'post',
            'data': testData,
            'success': function(data) {}
        });
    },
    acceptMessage: function(stdMessageObject) {
        switch (stdMessageObject.label) {
            case 'setFinalScore':
                this.finalScore.correct = stdMessageObject.parameterObject.score;
                this.finalScore.total = stdMessageObject.parameterObject.total;
                break;
            case 'setOutcome':
                this.winningOutcome = stdMessageObject.parameterObject.slug;
                break;
            case 'setAnswerHistory':
                this.answerHistory = stdMessageObject.parameterObject;
                break;
            case 'updateStats':
                this.postToServer();
                break;
            default:
                break;
        }
    },
}
window.addEventListener('DOMContentLoaded', function() {
    var quizWrapperElement = document.querySelector('#zw_demoQuiz')
    quizMediator.init([quizEventTracker, quizEngine, quizRenderer, quizPlayer, DataInteractor]);
    quizRenderer.init(quizMediator, quizWrapperElement);
    quizEngine.init(quizMediator, zw_realQuiz);
    var testingPagination = true;
    quizEngine.restart = hardRestartQuiz;
    quizEngine.endRound = hardEndRound;
    quizEngine.doCurrentState();
});
window.addEventListener('load', function() {
    if (GetCookie('quiz_' + zw_ajax.post_id)) {
        var anchorLink = document.querySelector('.quizAnchorLink');
        if (anchorLink) {
            $('html, body').animate({
                scrollTop: $(".quizAnchorLink").offset().top
            }, 500);
        }
    }
});
