
function randRange(lower, upper) {
    var range = upper - lower;
    return Math.random() * range + lower;
}

function bound(value, lower, upper) {
    // Enforce the given bound on the given value
    return value < lower ? lower : value > upper ? upper : value;
}

function distance(object1, object2) {
    // Computes the Euclidean distance of the two coordinates
    var deltaX = Math.abs(object1.x - object2.x);
    var deltaY = Math.abs(object1.y - object2.y);
    return Math.sqrt(deltaX ** 2 + deltaY ** 2);
}


function moveableObject(selector) {
    var item = $(selector);
    return {
        item: item,
        width: item.width(),
        height: item.height(),
        set: function(x, y) {
            // Put the moveable object at the given x/y coordinates:
            this.x = x;
            this.y = y;
            this.item.css({
                display: 'block',
                left: x,
                top: y,
            })
        },
        center: function() {
            // Returns the x/y coordinates of this object's center
            return {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2
            }
        }
    }
    return item;
}

function stationaryObject(selector) {
    var item = $(selector);
    return {
        item: item,
        width: item.width(),
        height: item.height()
    };
}



function Game() {
    // Select some moveable objects:
    this.hole = moveableObject('.mini-golf-hole');
    this.ball = moveableObject('.mini-golf-ball');
    this.aimers = $('.mini-golf-ball-aimers > div').map(function(i, item) {
        var aimer = moveableObject(item);
        aimer.index = $(item).data('item');
        return aimer
    });

    // Select some stationary objects:
    this.tee = stationaryObject('.mini-golf-tee');
    this.green = stationaryObject('.mini-golf-box');
    this.window = stationaryObject(window);

    // Helper method for getting the X/Y coordinates
    this.getHover = (event) => {
        // Get absolute mouse coordinates on the putting green:
        var offset = this.green.item.offset();
        var hoverX = event.pageX - offset.left - this.ball.width;
        var hoverY = event.pageY - offset.top - this.ball.height;
        return {
            x: hoverX,
            y: hoverY
        }
    }

    this.setBall = (complete) => {
        // Allow the user to set the initial position of the ball, within the
        // putting tee green:
        this.green.item.on('mousemove', (event) => {
            var hover = this.getHover(event)
            // Bound the ball coordinates to the tee's area, and set the ball's position:
            var hoverX = bound(hover.x, 0, this.tee.width);
            var hoverY = bound(hover.y, this.green.height - this.tee.height - this.ball.height, this.green.height - this.ball.height)
            this.ball.set(hoverX, hoverY);
        });

        // When the user clicks, place the ball there permenantly, and
        // call the completion callback:
        this.green.item.on('click', (event) => {
            this.green.item.unbind('mousemove');
            this.green.item.unbind('click');
            complete();
        });
    }


    this.awaitShot = (complete) => {
        // Here we await the user's shot, and call the completion handler with
        // a boolean determining whether or not the shot resulted in a completed
        // hole

        // Display the aiming helpers pre-shot:
        this.window.item.on('mousemove', (event) => {
            // Compute the delta vector from the current mouse possition,
            // and the current ball position:
            var hover = this.getHover(event);
            var delta = {
                x: this.ball.x - hover.x,
                y: this.ball.y - hover.y
            };
            var ballCenter = this.ball.center();

            // Reposisiton all aimers, based on the delta vector, scaled by
            // the various aimers index values (and offset by the small
            // height/width of the aimer):
            this.aimers.map((i, aimer) => {
                var aimerX = ballCenter.x + delta.x * aimer.index / 3 - aimer.width / 2;
                var aimerY = ballCenter.y + delta.y * aimer.index / 3 - aimer.height / 2;
                aimer.set(aimerX, aimerY);
            });
        });

        // Set a small timeout before we start allowing the user to take a shot:
        setTimeout(() => {
            $(window).on('click', (event) => {
                // First, remove any hover or click events for sending a shot:
                $(window).unbind('mousemove');
                $(window).unbind('click');
                // Next hide the aimer helpers:
                this.aimers.map((i, aimer) => aimer.item.hide())


                // Compute the delta vector from the current mouse position,
                // and the current ball position:
                var hover = this.getHover(event);
                var delta = {
                    x: this.ball.x - hover.x,
                    y: this.ball.y - hover.y
                };


                // Animate ball moving across the screen:
                var velocityScalar = 0.08;
                var ballHoleOverlapCount = 0;
                var interval = setInterval(() => {
                    // Compute the current velocity:
                    var velocity = {
                        x: delta.x * velocityScalar,
                        y: delta.y * velocityScalar,
                        absolute: function() {
                            return Math.abs(this.x) + Math.abs(this.y)
                        }
                    }
                    if (velocity.absolute() > 0.1) {

                        // Compute next incremental coordinates:
                        var newX = this.ball.x + velocity.x;
                        var newY = this.ball.y + velocity.y;

                        // TODO: clean up this bouncing code:
                        // Check for an x-Coordinate Bounce:
                        if (newX < 0) {
                            // X Bounce Left:
                            newX *= -1;
                            delta.x *= -1;
                        } else if (newX > this.green.width - this.ball.width) {
                            // X Bounce Right:
                            newX = 2 * (this.green.width - this.ball.width) - newX;
                            delta.x *= -1;
                        }

                        // Check for a y-coordinate Bounce:
                        if (newY < 0) {
                            // Y Bounce Top:
                            newY *= -1;
                            delta.y *= -1;
                        } else if (newY > this.green.height - this.ball.height) {
                            // Y Bounce Bottom:
                            newY = 2 * (this.green.height - this.ball.height) - newY;
                            delta.y *= -1;
                        }

                        // Reposition ball:
                        this.ball.set(newX, newY);

                        // Get the distance between the ball and the hole:
                        var ballCenter = this.ball.center();
                        var holeCenter = this.hole.center();
                        var ballHoleDistance = distance(ballCenter, holeCenter);
                        var holeRadius = this.hole.width / 2;

                        // Check if the ball is in the hole:
                        if (ballHoleDistance < holeRadius) {
                            // In order to enforce a reasonable ball speed, we
                            // require that the ball be overlapping the hole for
                            // at least 5 frames:
                            ballHoleOverlapCount += 1;
                            if (ballHoleOverlapCount > 15) {
                                clearInterval(interval);
                                complete(true);
                            }
                        } else {
                            ballHoleOverlapCount = 0;
                        }


                        // Add a friction factor to the ball's velocity:
                        velocityScalar *= 0.99;
                    } else {
                        clearInterval(interval);
                        complete(false);
                    }
                }, 1);
            })
        }, 1);
    }


    this.awaitCompletion = (shots, complete) => {
        console.log(`Taking shot number ${shots}`)
        this.awaitShot((isInHole) => {
            if (isInHole) {
                // The ball went in, so call the completion callback with the
                // number of shots it took:
                var hole = this.hole.center();
                this.ball.set(hole.x - this.ball.width / 2, hole.y - this.ball.height / 2);

                complete(shots);
            } else {
                // The ball is not yet in, so recursively call this function:
                shots = shots + 1;
                this.awaitCompletion(shots, complete);
            }
        });
    }


    this.start = () => {
        // Set the hole in a new random spot:
        var holeX = randRange(0.3, 0.95) * this.green.width;
        var holeY = randRange(0.05, 0.95) * this.green.height;
        this.hole.set(holeX, holeY);

        var playHole = () => {
            this.setBall(() => {
                this.awaitCompletion(0, (shots) => {
                    console.log(`Finished in ${shots} Shots`);
                    setTimeout(() => {
                        var holeX = randRange(0.3, 0.95) * this.green.width;
                        var holeY = randRange(0.05, 0.95) * this.green.height;
                        this.hole.set(holeX, holeY);
                        playHole();

                    }, 1500);
                });
            });
        }
        playHole()

    }

}


var game = new Game();
game.start();
