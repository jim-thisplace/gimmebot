function int(min, max) {
    return Math.floor(min + Math.random() * (max - min));
}

function woot() {
    var wootString = 'woo';

    var numOs = int(2, 6);
    for (; numOs > 0; numOs--) {
        wootString += 'o';
    }

    wootString += 't';

    var numExclamations = int(0, 5);
    for (; numExclamations > 0; numExclamations--) {
        wootString += '!';
    }

    if (Math.random() > 0.5) {
        wootString = wootString.toUpperCase();
    }

    return wootString;
}

function exclamation() {
    var exclamationString = '';
    var numExclamations   = int(0, 5);
    for (; numExclamations > 0; numExclamations--) {
        exclamationString += '!';
    }
    return exclamationString
}

module.exports = {
    woot        : woot,
    exclamation : exclamation
};