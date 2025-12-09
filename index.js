var fs = require('fs');
var _ = require('lodash');
var gravatar = require('gravatar');
var Mustache = require('mustache');
var formatDuration = require('date-fns/formatDuration');
var differenceInMonths = require('date-fns/differenceInMonths');
var startOfMonth = require('date-fns/startOfMonth');
var endOfMonth = require('date-fns/endOfMonth');
var addDays = require('date-fns/addDays');
const xmlhttprequest = require("xmlhttprequest");
const checkUrlType = require('check-url-type');


function getNetworkIconClass(network: string) {
    network = network.toLowerCase();
    switch (network) {
        // special cases
        case "google-plus":
        case "googleplus":
            return "fab fa-google-plus";
        case "flickr":
        case "flicker":
            return "fab fa-flickr";
        case "dribbble":
        case "dribble":
            return "fab fa-dribbble";
        case "codepen":
            return "fab fa-codepen";
        case "soundcloud":
            return "fab fa-soundcloud";
        case "reddit":
            return "fab fa-reddit";
        case "tumblr":
        case "tumbler":
            return "fab fa-tumblr";
        case "stack-overflow":
        case "stackoverflow":
            return "fab fa-stack-overflow";
        case "blog":
        case "rss":
            return "fas fa-rss";
        case "gitlab":
            return "fab fa-gitlab";
        case "keybase":
            return "fas fa-key";
        default:
            // try to automatically select the icon based on the name
            return "fab fa-" + network;
    }
}

function getMonth(startDateStr: string) {
    switch (startDateStr.substr(5, 2)) {
        case '01':
            return "January ";
        case '02':
            return "February ";
        case '03':
            return "March ";
        case '04':
            return "April ";
        case '05':
            return "May ";
        case '06':
            return "June ";
        case '07':
            return "July ";
        case '08':
            return "August ";
        case '09':
            return "September ";
        case '10':
            return "October ";
        case '11':
            return "November ";
        case '12':
            return "December ";
    }
}

class SplittedDateMixin {
    year?: string
    day?: string
    month?: ReturnType<typeof getMonth>
    mix(date: string) {
        this.year = (date || "").substr(0, 4);
        this.day = (date || "").substr(8, 2);
        this.month = getMonth(date || "");
    }
}

function getMimeType(url: string) {
    global.XMLHttpRequest = xmlhttprequest.XMLHttpRequest;
    return checkUrlType.get_type(url);
}

function capitalizeFirstLetter(row: string) {
    return row.charAt(0).toUpperCase() + row.slice(1);
}

function hasNonEmptyItem(array: unknown, field: string | null = null) {
    return Array.isArray(array) && array.length > 0 && (
        field === null
            ? true
            : array.some(item => item && item[field] != null && item[field] !== '')
    );
}

/** Проверка наличия данных */
function handleExistance(obj: { [key: string]: unknown }, ...nestedFieldsList: Array<[string, string] | string>) {
    for (let nestedFields of nestedFieldsList) {
        let initialKey: string, args: Parameters<typeof hasNonEmptyItem>;
        if (typeof nestedFields === 'string') {
            initialKey = nestedFields;
            args = [obj[nestedFields]];
        } else {
            initialKey = nestedFields[0];
            args = [obj[initialKey], nestedFields[1]];
        }
        obj[initialKey + 'Bool'] = hasNonEmptyItem(...args);
    }
}

function handleStringArrayExistance(obj: { [key: string]: unknown }, fieldName: string) {
    const value = obj[fieldName];
    if (Array.isArray(value) && value[0] && value[0] != "") {
        obj['bool' + capitalizeFirstLetter(fieldName)] = true;
    }
}

class SplittedDateRangeMixin {
    startDateYear?: string
    startDateMonth?: string | undefined
    endDateYear?: string
    endDateMonth?: string | undefined
    mix(startDate?: string, endDate?: string) {
        if (startDate) {
            this.startDateYear = startDate.substr(0, 4);
            this.startDateMonth = getMonth(startDate);
        }
        if (endDate) {
            this.endDateYear = endDate.substr(0, 4);
            this.endDateMonth = getMonth(endDate);
            if (Number(this.endDateYear) > new Date().getFullYear()) {
                this.endDateYear += " (expected)";
            }
        } else {
            this.endDateYear = 'Present'
        }
    }
}

class ExperienceMixin {
    experience?: string
    mix(startDate: string, endDate?: string) {
        if (startDate) {
            const months = differenceInMonths(
                addDays(endOfMonth(endDate ? new Date(endDate) : new Date()), 1),
                startOfMonth(new Date(startDate))
            );
            this.experience = formatDuration(
                {
                    years: Math.floor(months / 12),
                    months: months % 12,
                },
                {
                    format: ["years", "months"],
                }
            );
        }
    }
}

function handleWorkplace(w: any) {
    const { startDate, endDate } = w;
    SplittedDateRangeMixin.prototype.mix.call(w, startDate, endDate);
    handleStringArrayExistance(w, 'highlights');
    handleStringArrayExistance(w, 'keywords');
    ExperienceMixin.prototype.mix.call(w, startDate, endDate);
}

function handleEducation(e: any) {
    const { startDate, endDate } = e;
    SplittedDateRangeMixin.prototype.mix.call(e, startDate, endDate);
    handleStringArrayExistance(e, 'keywords');
    handleStringArrayExistance(e, 'courses');
    if (!e.area || !e.studyType) {
        e.educationDetail = (e.area == null ? '' : e.area) + (e.studyType == null ? '' : e.studyType);
    } else {
        e.educationDetail = e.area + ", " + e.studyType;
    }
}

function handleGravatar(basics: any) {
    if (!basics?.email) {
        return;
    }
    // TODO: check gravatar
    basics.gravatar = 'https:' + gravatar.url(basics.email, {
        s: '200',
        r: 'pg',
        d: 'mm'
    });
}

function handleImage(obj: any) {
    const { basics } = obj;
    handleGravatar(basics);
    const photo = basics?.image || basics?.gravatar;
    if (photo) {
        obj.photo = photo;
        obj.photoBool = true;
        obj.photoType = getMimeType(photo);
    }
}

function importFile(name: string) {
    return fs.readFileSync(__dirname + "/" + name, "utf-8");
}

function render(resumeObject: any) {
    const { basics } = resumeObject;

    basics.capitalName = _.upperCase(basics.name);

    handleImage(resumeObject);

    _.each(basics.profiles, function (p: any) {
        if (!p.iconClass) {
            p.iconClass = getNetworkIconClass(p.network);
        }
    });

    handleExistance(
        resumeObject,
        ['skills', 'name'],
        ['interests', 'name'],
        ['languages', 'language'],
        ['references', 'name'],
        ['publications', 'name'],
        ['awards', 'title'],
        ['education', 'institution'],
        ['projects', 'name'],
        'work',
        'volunteer'
    );

    // Work
    if (resumeObject.workBool) {
        _.each(resumeObject.work, handleWorkplace);
    }

    // Volunteer
    if (resumeObject.volunteerBool) {
        _.each(resumeObject.volunteer, handleWorkplace);
    }

    // Education
    if (resumeObject.educationBool) {
        _.each(resumeObject.education, handleEducation);
    }

    // Awards
    if (resumeObject.awardsBool) {
        _.each(resumeObject.awards, (a: any) => SplittedDateMixin.prototype.mix.call(a, a.date));
    }

    // Publications
    if (resumeObject.publicationsBool) {
        _.each(resumeObject.publications, (a: any) => SplittedDateMixin.prototype.mix.call(a, a.releaseDate));
    }


    // === CSS & шаблон ===
    {
        resumeObject.bootstrap = importFile("bootstrap.min.css");
        resumeObject.fontawesome = importFile("fontawesome.min.css");
        resumeObject.normalize = importFile("normalize.css");

        resumeObject.stylecss = importFile("style.css");
        resumeObject.printcss = importFile("print.css");
    }

    const theme = importFile("resume.template.html");

    const resumeHTML = Mustache.render(theme, resumeObject);

    return resumeHTML;
}


module.exports = {
    render: render,
    pdfRenderOptions: {
        mediaType: 'print',
        format: 'A4',
        margin: {
            top: 15,
            bottom: 15
        }
    }
}
