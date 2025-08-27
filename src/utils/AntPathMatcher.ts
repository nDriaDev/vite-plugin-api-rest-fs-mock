/**
 * Value class that holds information about the pattern, e.g. number of
 * occurrences of "*", "**", and "{" pattern elements.
 * @param {string} pattern
 * @class
 */
class PatternInfo {
    uriVars: number;
    singleWildcards: number;
    doubleWildcards: number;
    catchAllPattern: boolean;
    prefixPattern: boolean;
    length: number|null;
    pattern: string;

    constructor(pattern: string) {
        this.uriVars = 0;
        this.singleWildcards = 0;
        this.doubleWildcards = 0;
        this.catchAllPattern = false;
        this.prefixPattern = false;
        this.length = null;
        this.pattern = pattern;
        if (this.pattern != null) {
            this.initCounters();
            this.catchAllPattern = this.pattern === '/**';
            this.prefixPattern = !this.catchAllPattern && this.pattern.endsWith('/**');
        }
        if (this.uriVars === 0) {
            this.length = this.pattern != null ? this.pattern.length : 0;
        }
    }
    
    initCounters() {
        let pos = 0;
        if (this.pattern != null) {
            while (pos < this.pattern.length) {
                if (this.pattern.charAt(pos) === '{') {
                    this.uriVars++;
                    pos++;
                } else if (this.pattern.charAt(pos) === '*') {
                    if (pos + 1 < this.pattern.length && this.pattern.charAt(pos + 1) === '*') {
                        this.doubleWildcards++;
                        pos += 2;
                    } else if (pos > 0 && !(this.pattern.substring(pos - 1) === '.*')) {
                        this.singleWildcards++;
                        pos++;
                    } else {
                        pos++;
                    }
                } else {
                    pos++;
                }
            }
        }
    }

    getUriVars() {
        return this.uriVars;
    }

    getSingleWildcards() {
        return this.singleWildcards;
    }

    getDoubleWildcards() {
        return this.doubleWildcards;
    }

    isLeastSpecific() {
        return this.pattern == null || this.catchAllPattern;
    }

    isPrefixPattern() {
        return this.prefixPattern;
    }

    getTotalCount() {
        return this.uriVars + this.singleWildcards + 2 * this.doubleWildcards;
    }

    /**
     * Returns the length of the given pattern, where template variables are considered to be 1 long.
     * @return {number}
     */
    getLength() {
        if (this.length == null) {
            this.length = this.pattern != null
                ? this.pattern.replace(AntPathMatcher.VARIABLE_PATTERN_$LI$(),'#').length
                : 0;
        }
        return this.length;
    }
}
    
/**
 * The default {@link Comparator} implementation returned by
 * {@link #getPatternComparator(String)}.
 * <p>In order, the most "generic" pattern is determined by the following:
 * <ul>
 * <li>if it's null or a capture all pattern (i.e. it is equal to "/**")</li>
 * <li>if the other pattern is an actual match</li>
 * <li>if it's a catch-all pattern (i.e. it ends with "**"</li>
 * <li>if it's got more "*" than the other pattern</li>
 * <li>if it's got more "{foo}" than the other pattern</li>
 * <li>if it's shorter than the other pattern</li>
 * </ul>
 * @param {string} path
 * @class
 */
class AntPatternComparator {
    path: string;

    constructor(path: string) {
        this.path = path;
    }

    /**
     * Compare two patterns to determine which should match first, i.e. which
     * is the most specific regarding the current path.
     * @return {number} a negative integer, zero, or a positive integer as pattern1 is
     * more specific, equally specific, or less specific than pattern2.
     * @param {string} pattern1
     * @param {string} pattern2
     */
    compare(pattern1: string, pattern2: string) {
        const info1 = new PatternInfo(pattern1);
        const info2 = new PatternInfo(pattern2);
        if (info1.isLeastSpecific() && info2.isLeastSpecific()) {
            return 0;
        } else if (info1.isLeastSpecific()) {
            return 1;
        } else if (info2.isLeastSpecific()) {
            return -1;
        }
        const pattern1EqualsPath = pattern1 === this.path;
        const pattern2EqualsPath = pattern2 === this.path;
        if (pattern1EqualsPath && pattern2EqualsPath) {
            return 0;
        } else if (pattern1EqualsPath) {
            return -1;
        } else if (pattern2EqualsPath) {
            return 1;
        }
        if (info1.isPrefixPattern() && info2.isPrefixPattern()) {
            return info2.getLength() - info1.getLength();
        } else if (info1.isPrefixPattern() && info2.getDoubleWildcards() === 0) {
            return 1;
        } else if (info2.isPrefixPattern() && info1.getDoubleWildcards() === 0) {
            return -1;
        }
        if (info1.getTotalCount() !== info2.getTotalCount()) {
            return info1.getTotalCount() - info2.getTotalCount();
        }
        if (info1.getLength() !== info2.getLength()) {
            return info2.getLength() - info1.getLength();
        }
        if (info1.getSingleWildcards() < info2.getSingleWildcards()) {
            return -1;
        } else if (info2.getSingleWildcards() < info1.getSingleWildcards()) {
            return 1;
        }
        if (info1.getUriVars() < info2.getUriVars()) {
            return -1;
        } else if (info2.getUriVars() < info1.getUriVars()) {
            return 1;
        }
        return 0;
    }
}

/**
 * Tests whether or not a string matches against a pattern via a {@link Pattern}.
 * <p>The pattern may contain special characters: '*' means zero or more characters; '?' means one and
 * only one character; '{' and '}' indicate a URI template pattern. For example <tt>/users/{user}</tt>.
 * @param {string} pattern
 * @param {boolean} caseSensitive
 * @class
 */
class AntPathStringMatcher {
    // ((?s).*) single line mode
    static DEFAULT_VARIABLE_PATTERN: string = '(.*)';
    static GLOB_PATTERN: null | RegExp;
    exactMatch: boolean;
    pattern: RegExp|null;
    variableNames: string[];
    rawPattern: string;
    caseSensitive: boolean;

    constructor(pattern: string, caseSensitive: boolean) {
        this.exactMatch = false;
        this.pattern = null;
        this.variableNames = [];
        this.rawPattern = pattern;
        this.caseSensitive = caseSensitive;
        let patternBuilder = '';
        let matcher;
        let end = 0;
        while (null != (matcher = AntPathStringMatcher.GLOB_PATTERN_$LI$().exec(pattern))) {
            patternBuilder = patternBuilder + this.quote(pattern, end, matcher.index);
            const match = matcher[0];
            if ('?' === match) {
                patternBuilder = patternBuilder + '.';
            } else if ('*' === match) {
                patternBuilder = patternBuilder + '.*';
            } else if (match.startsWith('{') && match.endsWith('}')) {
                const colonIdx = match.indexOf(':');
                if (colonIdx === -1) {
                    patternBuilder = patternBuilder + AntPathStringMatcher.DEFAULT_VARIABLE_PATTERN;
                    this.variableNames.push(matcher[1]);
                } else {
                    const variablePattern = match.substring(colonIdx + 1, match.length - 1);
                    patternBuilder = patternBuilder + '(' + variablePattern + ')';
                    const variableName = match.substring(1, colonIdx);
                    this.variableNames.push(variableName);
                }
            }
            end = AntPathStringMatcher.GLOB_PATTERN_$LI$().lastIndex;
        }
        if (end === 0) {
            this.exactMatch = true;
            this.pattern = null;
        } else {
            this.exactMatch = false;
            patternBuilder = patternBuilder + this.quote(pattern, end, pattern.length);
            this.pattern = this.caseSensitive ? new RegExp(patternBuilder, 'usg') : new RegExp(patternBuilder, 'iusg');
        }
    }
    
    static GLOB_PATTERN_$LI$() {
        if (AntPathStringMatcher.GLOB_PATTERN == null) {
            AntPathStringMatcher.GLOB_PATTERN = new RegExp('\\?|\\*|\\{((?:\\{[^/]+?}|[^/{}]|\\\\[{}])+?)}', 'g');
        }
        return AntPathStringMatcher.GLOB_PATTERN;
    }
    
    quote(s: string, start: number, end: number) {
        if (start === end) {
            return '';
        }
        s = s.substring(start, end);
        s = s.replace(/[[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        return s;
    }

    groupCount(regex: RegExp) {
        return new RegExp(regex.source + '|').exec('')!.length - 1;
    }

    matches(regex: RegExp, src: string) {
        return new RegExp('^' + regex.source + '$', regex.flags).test(src);
    }

    group(regex: RegExp, src: string) {
        return new RegExp(regex.source, regex.flags).exec(src)!;
    }

    /**
     * Main entry point.
     * @return {boolean} {@code true} if the string matches against the pattern, or {@code false} otherwise.
     * @param {string} str
     * @param {*} uriTemplateVariables
     */
    matchStrings(str: string, uriTemplateVariables: Record<string, string>|null) {
        if (this.exactMatch) {
            return this.caseSensitive
                ? this.rawPattern === str
                : this.rawPattern.toUpperCase() === (str === null ? str : str.toUpperCase());
        } else if (this.pattern != null) {
            const match = this.matches(this.pattern, str);
            if (match) {
                if (uriTemplateVariables != null) {
                    const matcherGroupCount = this.groupCount(this.pattern);
                    if (this.variableNames.length !== matcherGroupCount) {
                        throw new Error('The number of capturing groups in the pattern segment ' + this.pattern + ' does not match the number of URI template variables it defines, which can occur if capturing groups are used in a URI template regex. Use non-capturing groups instead.');
                    }
                    const group = this.group(this.pattern, str);
                    for (let i = 1; i <= matcherGroupCount; i++) {
                        const name = this.variableNames[i - 1];
                        const value = group[i];
                        uriTemplateVariables[name] = value;
                    }
                }
                return true;
            }
        }
        return false;
    }
}

/**
 * A simple cache for patterns that depend on the configured path separator.
 * @param {string} pathSeparator
 * @class
 */
class PathSeparatorPatternCache {
    endsOnWildCard: string;
    endsOnDoubleWildCard: string;
    
    constructor(pathSeparator: string) {
        this.endsOnWildCard = pathSeparator + '*';
        this.endsOnDoubleWildCard = pathSeparator + '**';
    }
    
    getEndsOnWildCard() {
        return this.endsOnWildCard;
    }

    getEndsOnDoubleWildCard() {
        return this.endsOnDoubleWildCard;
    }
}

export class AntPathMatcher {
    static readonly DEFAULT_PATH_SEPARATOR: string = '/';
    static readonly CACHE_TURNOFF_THRESHOLD: number = 65536;
    static EMPTY_STRING_ARRAY: [] | null;
    static VARIABLE_PATTERN: RegExp | null;
    static WHITESPACE: RegExp | null;
    static WILDCARD_CHARS: string[] | null;
    caseSensitive: boolean;
    trimTokens: boolean;
    cachePatterns: boolean | null;
    tokenizedPatternCache: Record<string, string|string[]>;
    stringMatcherCache: Record<string, AntPathStringMatcher>;
    pathSeparator: string;
    pathSeparatorPatternCache: PathSeparatorPatternCache;

    constructor(pathSeparator?: string) {
        this.caseSensitive = true;
        this.trimTokens = false;
        this.cachePatterns = null;
        this.tokenizedPatternCache = {};
        this.stringMatcherCache = {};
        this.pathSeparator = pathSeparator ? pathSeparator : AntPathMatcher.DEFAULT_PATH_SEPARATOR;
        this.pathSeparatorPatternCache = new PathSeparatorPatternCache(this.pathSeparator);
    }

    static EMPTY_STRING_ARRAY_$LI$() {
        if (AntPathMatcher.EMPTY_STRING_ARRAY == null) {
            AntPathMatcher.EMPTY_STRING_ARRAY = [];
        }
        return AntPathMatcher.EMPTY_STRING_ARRAY;
    }

    static VARIABLE_PATTERN_$LI$() {
        if (AntPathMatcher.VARIABLE_PATTERN == null) {
            AntPathMatcher.VARIABLE_PATTERN = new RegExp('\\{[^/]+?}', 'g');
        }
        return AntPathMatcher.VARIABLE_PATTERN;
    }

    static WHITESPACE_$LI$() {
        if (AntPathMatcher.WHITESPACE == null) {
            // eslint-disable-next-line no-control-regex
            AntPathMatcher.WHITESPACE = new RegExp("[\\t-\\r \\u1680\\u180E\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000\\uFEFF]|[\\x1C-\\x1F]", "g");
        }
        return AntPathMatcher.WHITESPACE;
    };
    
    static WILDCARD_CHARS_$LI$() {
        if (AntPathMatcher.WILDCARD_CHARS == null) {
            AntPathMatcher.WILDCARD_CHARS = ['*', '?', '{'];
        }
        return AntPathMatcher.WILDCARD_CHARS;
    }

    /**
     * Set the path separator to use for pattern parsing.
     * <p>Default is "/", as in Ant.
     * @param {string} pathSeparator
     */
    setPathSeparator(pathSeparator: string) {
        this.pathSeparator = pathSeparator ? pathSeparator : AntPathMatcher.DEFAULT_PATH_SEPARATOR;
        this.pathSeparatorPatternCache = new PathSeparatorPatternCache(this.pathSeparator);
    }

    /**
     * Specify whether to perform pattern matching in a case-sensitive fashion.
     * <p>Default is {@code true}. Switch this to {@code false} for case-insensitive matching.
     * @since 4.2
     * @param {boolean} caseSensitive
     */
    setCaseSensitive(caseSensitive: boolean) {
        this.caseSensitive = caseSensitive;
    }

    /**
     * Specify whether to trim tokenized paths and patterns.
     * <p>Default is {@code false}.
     * @param {boolean} trimTokens
     */
    setTrimTokens(trimTokens: boolean) {
        this.trimTokens = trimTokens;
    }

    /**
     * Specify whether to cache parsed pattern metadata for patterns passed
     * into this matcher's {@link #match} method. A value of {@code true}
     * activates an unlimited pattern cache; a value of {@code false} turns
     * the pattern cache off completely.
     * <p>Default is for the cache to be on, but with the variant to automatically
     * turn it off when encountering too many patterns to cache at runtime
     * (the threshold is 65536), assuming that arbitrary permutations of patterns
     * are coming in, with little chance for encountering a recurring pattern.
     * @see #getStringMatcher(String)
     * @param {boolean} cachePatterns
     */
    setCachePatterns(cachePatterns: boolean) {
        this.cachePatterns = cachePatterns;
    };
    
    deactivatePatternCache() {
        this.cachePatterns = false;
        this.tokenizedPatternCache = {};
        this.stringMatcherCache = {};
    }
    
    isPattern(path: string) {
        if (!path) {
            return false;
        }
        let uriVar = false;
        for (let i = 0; i < path.length; i++) {
            const c = path.charAt(i);
            if (c === '*' || c === '?') {
                return true;
            }
            if (c === '{') {
                uriVar = true;
                continue;
            }
            if (c === '}' && uriVar) {
                return true;
            }
        }
        return false;
    }

    match(pattern: string, path: string, fullPath?: boolean, urlVariable?: Record<string, string> | null) {
        return this.doMatch(pattern, path, fullPath ?? true, urlVariable ?? null);
    }

    matchStart(pattern: string, path: string) {
        return this.doMatch(pattern, path, false, null);
    }

    isPotentialMatch(path: string, pattDirs: string | string[]) {
        if (!this.trimTokens) {
            let pos = 0;
            for (let index = 0; index < pattDirs.length; index++) {
                const pattDir = pattDirs[index];
                let skipped = this.skipSeparator(path, pos, this.pathSeparator);
                pos += skipped;
                skipped = this.skipSegment(path, pos, pattDir);
                if (skipped < pattDir.length) {
                    return (
                        skipped > 0 ||
                        (pattDir.length > 0 && this.isWildcardChar(pattDir.charAt(0)))
                    );
                }
                pos += skipped;
            }
        }
        return true;
    }

    skipSegment(path: string, pos: number, prefix: string) {
        let skipped = 0;
        for (let i = 0; i < prefix.length; i++) {
            const c = prefix.charAt(i);
            if (this.isWildcardChar(c)) {
                return skipped;
            }
            const currPos = pos + skipped;
            if (currPos >= path.length) {
                return 0;
            }
            if (c === path.charAt(currPos)) {
                skipped++;
            }
        }
        return skipped;
    }
    
    skipSeparator(path: string, pos: number, separator: string) {
        let skipped = 0;
        while (path.startsWith(separator, pos + skipped)) {
            skipped += separator.length;
        }
        return skipped;
    }

    isWildcardChar(c: string) {
        for (let index = 0; index < AntPathMatcher.WILDCARD_CHARS_$LI$().length; index++) {
            const candidate = AntPathMatcher.WILDCARD_CHARS_$LI$()[index];
            if (c === candidate) {
                return true;
            }
        }
        return false;
    }

    /**
     * Tokenize the given path pattern into parts, based on this matcher's settings.
     * <p>Performs caching based on {@link #setCachePatterns}, delegating to
     * {@link #tokenizePath(String)} for the actual tokenization algorithm.
     * @param {string} pattern the pattern to tokenize
     * @return {java.lang.String[]} the tokenized pattern parts
     */
    tokenizePattern(pattern: string) {
        let tokenized = null;
        const cachePatterns = this.cachePatterns;
        if (cachePatterns == null || cachePatterns) {
            tokenized = this.tokenizedPatternCache[pattern];
            tokenized = tokenized === undefined ? null : tokenized;
        }
        if (tokenized == null) {
            tokenized = this.tokenizePath(pattern);
            if (cachePatterns == null && Object.keys(this.tokenizedPatternCache).length >= AntPathMatcher.CACHE_TURNOFF_THRESHOLD) {
                this.deactivatePatternCache();
                return tokenized;
            }
            if (cachePatterns == null || cachePatterns) {
                this.tokenizedPatternCache[pattern] = tokenized;
            }
        }
        return tokenized;
    }

    /**
     * Tokenize the given path into parts, based on this matcher's settings.
     * @param {string} path the path to tokenize
     * @return {java.lang.String[]} the tokenized path parts
     */
    tokenizePath(path: string) {
        return AntPathMatcher.tokenizeToStringArray(path, this.pathSeparator, this.trimTokens, true);
    }

    /**
     * Test whether or not a string matches against a pattern.
     * @param {string} pattern the pattern to match against (never {@code null})
     * @param {string} str the String which must be matched against the pattern (never {@code null})
     * @return {boolean} {@code true} if the string matches against the pattern, or {@code false} otherwise
     * @param {*} uriTemplateVariables
     * @private
     */
    matchStrings(pattern: string, str: string, uriTemplateVariables: Record<string, string> | null) {
        return this.getStringMatcher(pattern).matchStrings(str, uriTemplateVariables);
    }

    /**
     * Build or retrieve an {@link AntPathStringMatcher} for the given pattern.
     * <p>The default implementation checks this AntPathMatcher's internal cache
     * (see {@link #setCachePatterns}), creating a new AntPathStringMatcher instance
     * if no cached copy is found.
     * <p>When encountering too many patterns to cache at runtime (the threshold is 65536),
     * it turns the default cache off, assuming that arbitrary permutations of patterns
     * are coming in, with little chance for encountering a recurring pattern.
     * <p>This method may be overridden to implement a custom cache strategy.
     * @param {string} pattern the pattern to match against (never {@code null})
     * @return {AntPathMatcher.AntPathStringMatcher} a corresponding AntPathStringMatcher (never {@code null})
     * @see #setCachePatterns
     */
    getStringMatcher(pattern: string) {
        let matcher = null;
        const cachePatterns = this.cachePatterns;
        if (cachePatterns == null || cachePatterns) {
            matcher = this.stringMatcherCache[pattern];
            matcher = matcher === undefined ? null : matcher;
        }
        if (matcher == null) {
            matcher = new AntPathStringMatcher(pattern, this.caseSensitive);
            if (cachePatterns == null && Object.keys(this.stringMatcherCache).length >= AntPathMatcher.CACHE_TURNOFF_THRESHOLD) {
                this.deactivatePatternCache();
                return matcher;
            }
            if (cachePatterns == null || cachePatterns) {
                this.stringMatcherCache[pattern] = matcher;
            }
        }
        return matcher;
    }

    /**
     * Given a pattern and a full path, determine the pattern-mapped part. <p>For example: <ul>
     * <li>'{@code /docs/cvs/commit.html}' and '{@code /docs/cvs/commit.html} -> ''</li>
     * <li>'{@code /docs/*}' and '{@code /docs/cvs/commit} -> '{@code cvs/commit}'</li>
     * <li>'{@code /docs/cvs/*.html}' and '{@code /docs/cvs/commit.html} -> '{@code commit.html}'</li>
     * <li>'{@code /docs/**}' and '{@code /docs/cvs/commit} -> '{@code cvs/commit}'</li>
     * <li>'{@code /docs/**\/*.html}' and '{@code /docs/cvs/commit.html} -> '{@code cvs/commit.html}'</li>
     * <li>'{@code /*.html}' and '{@code /docs/cvs/commit.html} -> '{@code docs/cvs/commit.html}'</li>
     * <li>'{@code *.html}' and '{@code /docs/cvs/commit.html} -> '{@code /docs/cvs/commit.html}'</li>
     * <li>'{@code *}' and '{@code /docs/cvs/commit.html} -> '{@code /docs/cvs/commit.html}'</li> </ul>
     * <p>Assumes that {@link #match} returns {@code true} for '{@code pattern}' and '{@code path}', but
     * does <strong>not</strong> enforce this.
     * @param {string} pattern
     * @param {string} path
     * @return {string}
     */
    extractPathWithinPattern(pattern: string, path: string) {
        const patternParts = AntPathMatcher.tokenizeToStringArray(pattern, this.pathSeparator, this.trimTokens, true);
        const pathParts = AntPathMatcher.tokenizeToStringArray(path, this.pathSeparator, this.trimTokens, true);
        let str = '';
        let pathStarted = false;
        for (let segment = 0; segment < patternParts.length; segment++) {
            const patternPart = patternParts[segment];
            if (patternPart.indexOf('*') > -1 || patternPart.indexOf('?') > -1) {
                for (; segment < pathParts.length; segment++) {
                    if (pathStarted || (segment == 0 && !pattern.startsWith(this.pathSeparator))) {
                        str = str + this.pathSeparator;
                    }
                    str = str + pathParts[segment];
                    pathStarted = true;
                }
            }
        }
        return str;
    }

    extractUriTemplateVariables(pattern: string, path: string) {
        const variables = {};
        const result = this.doMatch(pattern, path, true, variables);
        if (!result) {
            throw new Error('Pattern "' + pattern + '" is not a match for "' + path + '"');
        }
        return variables;
    }

    /**
     * Combine two patterns into a new pattern.
     * <p>This implementation simply concatenates the two patterns, unless
     * the first pattern contains a file extension match (e.g., {@code *.html}).
     * In that case, the second pattern will be merged into the first. Otherwise,
     * an {@code IllegalArgumentException} will be thrown.
     * <h3>Examples</h3>
     * <table border="1">
     * <tr><th>Pattern 1</th><th>Pattern 2</th><th>Result</th></tr>
     * <tr><td>{@code null}</td><td>{@code null}</td><td>&nbsp;</td></tr>
     * <tr><td>/hotels</td><td>{@code null}</td><td>/hotels</td></tr>
     * <tr><td>{@code null}</td><td>/hotels</td><td>/hotels</td></tr>
     * <tr><td>/hotels</td><td>/bookings</td><td>/hotels/bookings</td></tr>
     * <tr><td>/hotels</td><td>bookings</td><td>/hotels/bookings</td></tr>
     * <tr><td>/hotels/*</td><td>/bookings</td><td>/hotels/bookings</td></tr>
     * <tr><td>/hotels/&#42;&#42;</td><td>/bookings</td><td>/hotels/&#42;&#42;/bookings</td></tr>
     * <tr><td>/hotels</td><td>{hotel}</td><td>/hotels/{hotel}</td></tr>
     * <tr><td>/hotels/*</td><td>{hotel}</td><td>/hotels/{hotel}</td></tr>
     * <tr><td>/hotels/&#42;&#42;</td><td>{hotel}</td><td>/hotels/&#42;&#42;/{hotel}</td></tr>
     * <tr><td>/*.html</td><td>/hotels.html</td><td>/hotels.html</td></tr>
     * <tr><td>/*.html</td><td>/hotels</td><td>/hotels.html</td></tr>
     * <tr><td>/*.html</td><td>/*.txt</td><td>{@code IllegalArgumentException}</td></tr>
     * </table>
     * @param {string} pattern1 the first pattern
     * @param {string} pattern2 the second pattern
     * @return {string} the combination of the two patterns
     * @throws IllegalArgumentException if the two patterns cannot be combined
     */
    combine(pattern1: string, pattern2: string) {
        if (!AntPathMatcher.hasText(pattern1) && !AntPathMatcher.hasText(pattern2)) {
            return '';
        }
        if (!AntPathMatcher.hasText(pattern1)) {
            return pattern2;
        }
        if (!AntPathMatcher.hasText(pattern2)) {
            return pattern1;
        }
        const pattern1ContainsUriVar = pattern1.indexOf('{') !== -1;
        if (!(pattern1 === pattern2) && !pattern1ContainsUriVar && this.match(pattern1, pattern2)) {
            // /* + /hotel -> /hotel ; "/*.*" + "/*.html" -> /*.html
            // However /user + /user -> /usr/user ; /{foo} + /bar -> /{foo}/bar
            return pattern2;
        }

        // /hotels/* + /booking -> /hotels/booking
        // /hotels/* + booking -> /hotels/booking
        if (pattern1.endsWith(this.pathSeparatorPatternCache.getEndsOnWildCard())) {
            return this.concat(pattern1.substring(0, pattern1.length - 2), pattern2);
        }

        // /hotels/** + /booking -> /hotels/**/booking
        // /hotels/** + booking -> /hotels/**/booking
        if (pattern1.endsWith(this.pathSeparatorPatternCache.getEndsOnDoubleWildCard())) {
            return this.concat(pattern1, pattern2);
        }

        const starDotPos1 = pattern1.indexOf('*.');
        if (pattern1ContainsUriVar || starDotPos1 === -1 || this.pathSeparator === '.') {
            return this.concat(pattern1, pattern2);
        }
        const ext1 = pattern1.substring(starDotPos1 + 1);
        const dotPos2 = pattern2.indexOf('.');
        const file2 = dotPos2 === -1 ? pattern2 : pattern2.substring(0, dotPos2);
        const ext2 = dotPos2 === -1 ? '' : pattern2.substring(dotPos2);
        const ext1All = ext1 === '.*' || /* isEmpty */ ext1.length === 0;
        const ext2All = ext2 === '.*' || /* isEmpty */ ext2.length === 0;
        if (!ext1All && !ext2All) {
            throw new Error('Cannot combine patterns: ' + pattern1 + ' vs ' + pattern2);
        }
        const ext = ext1All ? ext2 : ext1;
        return file2 + ext;
    }

    concat(path1: string, path2: string) {
        const path1EndsWithSeparator = path1.endsWith(this.pathSeparator);
        const path2StartsWithSeparator = path2.startsWith(this.pathSeparator);
        if (path1EndsWithSeparator && path2StartsWithSeparator) {
            return path1 + path2.substring(1);
        } else if (path1EndsWithSeparator || path2StartsWithSeparator) {
            return path1 + path2;
        } else {
            return path1 + this.pathSeparator + path2;
        }
    }

    /**
     * Given a full path, returns a {@link Comparator} suitable for sorting patterns in order of
     * explicitness.
     * <p>This {@code Comparator} will {@linkplain java.util.List#sort(Comparator) sort}
     * a list so that more specific patterns (without URI templates or wild cards) come before
     * generic patterns. So given a list with the following patterns, the returned comparator
     * will sort this list so that the order will be as indicated.
     * <ol>
     * <li>{@code /hotels/new}</li>
     * <li>{@code /hotels/{hotel}}</li>
     * <li>{@code /hotels/*}</li>
     * </ol>
     * <p>The full path given as parameter is used to test for exact matches. So when the given path
     * is {@code /hotels/2}, the pattern {@code /hotels/2} will be sorted before {@code /hotels/1}.
     * @param {string} path the full path to use for comparison
     * @return {*} a comparator capable of sorting patterns in order of explicitness
     */
    getPatternComparator(path: string) {
        return new AntPatternComparator(path);
    }

    /**
     * Check whether the given {@code String} contains actual <em>text</em>.
     * <p>More specifically, this method returns {@code true} if the
     * {@code String} is not {@code null}, its length is greater than 0,
     * and it contains at least one non-whitespace character.
     * @param {string} str the {@code String} to check (may be {@code null})
     * @return {boolean} {@code true} if the {@code String} is not {@code null}, its
     * length is greater than 0, and it does not contain whitespace only
     * @see #hasText(CharSequence)
     * @see #hasLength(String)
     * @see Character#isWhitespace
     */
    static hasText(str: string) {
        return (str != null && !(str.length === 0) && AntPathMatcher.containsText(str));
    }

    static containsText(str: string) {
        const strLen = str.length;
        for (let i = 0; i < strLen; i++) {
            if (!AntPathMatcher.isWhitespace(str.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Tokenize the given {@code String} into a {@code String} array via a
     * {@link StringTokenizer}.
     * <p>The given {@code delimiters} string can consist of any number of
     * delimiter characters. Each of those characters can be used to separate
     * tokens. A delimiter is always a single character; for multi-character
     * delimiters, consider using {@link #delimitedListToStringArray}.
     * @param {string} str the {@code String} to tokenize (potentially {@code null} or empty)
     * @param {string} delimiters the delimiter characters, assembled as a {@code String}
     * (each of the characters is individually considered as a delimiter)
     * @param {boolean} trimTokens trim the tokens via {@link String#trim()}
     * @param {boolean} ignoreEmptyTokens omit empty tokens from the result array
     * (only applies to tokens that are empty after trimming; StringTokenizer
     * will not consider subsequent delimiters as token in the first place).
     * @return {java.lang.String[]} an array of the tokens
     * @see java.util.StringTokenizer
     * @see String#trim()
     * @see #delimitedListToStringArray
     */
    static tokenizeToStringArray(str: string, delimiters: string, trimTokens: boolean, ignoreEmptyTokens: boolean) {
        if (str == null) {
            return AntPathMatcher.EMPTY_STRING_ARRAY_$LI$();
        }
        const tokenStrings = str.split(delimiters);
        const tokens = [];
        for (let index = 0; index < tokenStrings.length; index++) {
            let token = tokenStrings[index];
            if (trimTokens) {
                token = token.trim();
            }
            if (!ignoreEmptyTokens || token.length > 0) {
                tokens.push(token);
            }
        }
        return tokens;
    };

    static isWhitespace(ch: string) {
        return AntPathMatcher.WHITESPACE_$LI$().test(ch);
    }

    /**
     * Actually match the given {@code path} against the given {@code pattern}.
     * @param {string} pattern the pattern to match against
     * @param {string} path the path to test
     * @param {boolean} fullMatch whether a full pattern match is required (else a pattern match
     * as far as the given base path goes is sufficient)
     * @return {boolean} {@code true} if the supplied {@code path} matched, {@code false} if it didn't
     * @param {*} uriTemplateVariables
     */
    doMatch(pattern: string, path: string, fullMatch: boolean, uriTemplateVariables: Record<string, string> | null) {
        if (path == null || path.startsWith(this.pathSeparator) !== pattern.startsWith(this.pathSeparator)) {
            return false;
        }
        const pattDirs = this.tokenizePattern(pattern);
        if (fullMatch && this.caseSensitive && !this.isPotentialMatch(path, pattDirs)) {
            return false;
        }
        const pathDirs = this.tokenizePath(path);
        let pattIdxStart = 0;
        let pattIdxEnd = pattDirs.length - 1;
        let pathIdxStart = 0;
        let pathIdxEnd = pathDirs.length - 1;
        while (pattIdxStart <= pattIdxEnd && pathIdxStart <= pathIdxEnd) {
            const pattDir = pattDirs[pattIdxStart];
            if ('**' === pattDir) {
                break;
            }
            if (!this.matchStrings(pattDir, pathDirs[pathIdxStart], uriTemplateVariables)) {
                return false;
            }
            pattIdxStart++;
            pathIdxStart++;
        }
        if (pathIdxStart > pathIdxEnd) {
            if (pattIdxStart > pattIdxEnd) {
                return (pattern.endsWith(this.pathSeparator) === path.endsWith(this.pathSeparator));
            }
            if (!fullMatch) {
                return true;
            }
            if (pattIdxStart === pattIdxEnd && pattDirs[pattIdxStart] === '*' && path.endsWith(this.pathSeparator)) {
                return true;
            }
            for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
                if (!(pattDirs[i] === '**')) {
                    return false;
                }
            }
            return true;
        } else if (pattIdxStart > pattIdxEnd) {
            return false;
        } else if (!fullMatch && '**' === pattDirs[pattIdxStart]) {
            return true;
        }
        while (pattIdxStart <= pattIdxEnd && pathIdxStart <= pathIdxEnd) {
            const pattDir = pattDirs[pattIdxEnd];
            if (pattDir === '**') {
                break;
            }
            if (
                !this.matchStrings(pattDir, pathDirs[pathIdxEnd], uriTemplateVariables)
            ) {
                return false;
            }
            pattIdxEnd--;
            pathIdxEnd--;
        }
        if (pathIdxStart > pathIdxEnd) {
            for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
                if (!(pattDirs[i] === '**')) {
                    return false;
                }
            }
            return true;
        }
        while (pattIdxStart !== pattIdxEnd && pathIdxStart <= pathIdxEnd) {
            let patIdxTmp = -1;
            for (let i = pattIdxStart + 1; i <= pattIdxEnd; i++) {
                if (pattDirs[i] === '**') {
                    patIdxTmp = i;
                    break;
                }
            }
            if (patIdxTmp === pattIdxStart + 1) {
                pattIdxStart++;
                continue;
            }
            const patLength = patIdxTmp - pattIdxStart - 1;
            const strLength = pathIdxEnd - pathIdxStart + 1;
            let foundIdx = -1;
            strLoop: for (let i = 0; i <= strLength - patLength; i++) {
                for (let j = 0; j < patLength; j++) {
                    const subPat = pattDirs[pattIdxStart + j + 1];
                    const subStr = pathDirs[pathIdxStart + i + j];
                    if (!this.matchStrings(subPat, subStr, uriTemplateVariables)) {
                        continue strLoop;
                    }
                }
                foundIdx = pathIdxStart + i;
                break;
            }
            if (foundIdx === -1) {
                return false;
            }
            pattIdxStart = patIdxTmp;
            pathIdxStart = foundIdx + patLength;
        }
        for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
            if (!(pattDirs[i] === '**')) {
                return false;
            }
        }
        return true;
    }
}
