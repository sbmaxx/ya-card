import React from 'react';

const I18N = {
    ru: {
        tel: "тел.: ",
        telExt: ", доб. ",
        cell: "моб.: "
    },
    en: {
        tel: "tel. ",
        telExt: " ext. ",
        cell: "cell. "
    },
};

function CardLink({ href, children, itemProp }) {
    return <a href={href} itemProp={itemProp} target="_blank" rel="noopener" className="card__link">{children}</a>;
}

function CardSwitch({ langs }) {
    return (
        <div
            className="card__switch">
                {langs.map((lang, i) => <a
                    className={`card__link ${i === 0 ? 'card__link_disabled_yes' : ''}`}
                    href={`#${lang}`}
                    data-lang={lang}
                    key={lang}>{lang}</a>)}
        </div>
    )
}

function rawNumber(strNumber) {
    return strNumber.replace(/\(|\)|\s|\-/g, '');
}

class CardSide extends React.Component {
    render() {
        const { address, company, contact, lang, name, position, index } = this.props;
        return (
            <div
                className={`card__side card__side_lang_${lang} card__side_state_${index === 0 ? 'opened' : 'closed'} card__layout`}
                data-lang={lang}
                itemScope itemType="http://data-vocabulary.org/Person">
                <div className="card__content card__rectangle">
                    <a className="card__logo" target="_blank" rel="noopener" href={company.site}><span itemProp="affiliation">{company.name}</span></a>
                    <div className="card__text">
                        <div className="card__title">
                            <h1 className="card__name" itemProp="name">{name}</h1>
                            <div className="card__position" itemProp="title">{position}</div>
                        </div>
                        <div className="card__address" itemProp="address" itemScope itemType="http://data-vocabulary.org/Address">
                            {lang === 'ru' && (
                                <>
                                    <span className="card__country" itemProp="country-name">{address.country}</span>,{' '}
                                    <span className="card__city" itemProp="locality">{address.city}</span>,{' '}
                                    <span className="card__zip" itemProp="postal-code">{address.zip}</span>
                                    <br />
                                    <span className="card__street-address" itemProp="street-address">{address['street-address']}</span>
                                </>)}
                            {lang === 'en' && (
                                <>
                                    <span className="card__street-address" itemProp="street-address">{address['street-address']}</span>
                                    <br />
                                    <span className="card__city" itemProp="locality">{address.city}</span>,{' '}
                                    <span className="card__zip" itemProp="postal-code">{address.zip}</span>,{' '}
                                    <span className="card__country" itemProp="country-name">{address.country}</span>
                                </>
                            )}
                        </div>
                        <div className="card__contact">
                            {(contact.work && !contact.workExt) &&<div className="card__tel card__tel_type_work">{I18N[lang].tel} <a className="card__phone-link"
                                href={`tel:${rawNumber(contact.work)}`}>{contact.work}</a></div>}

                            {(contact.work && contact.workExt) &&<div className="card__tel card__tel_type_work">{I18N[lang].tel} <a className="card__phone-link"
                                href={`tel:${rawNumber(contact.work)},${contact.workExt}`}>{contact.work}</a>, {I18N[lang].ext} {contact.workExt}</div>}

                            {contact.cell && <div className="card__tel card__tel_type_cell">{I18N[lang].cell} <a className="card__phone-link"
                                href={`tel:${rawNumber(contact.cell)}`}>{contact.cell}</a></div>}

                            {(contact.work || contact.cell) && <div className="card__gap"></div>}

                            {contact.email && <div className="card__email">
                                <CardLink href={`mailto:${contact.email}`}>{contact.email}</CardLink>
                            </div>}

                            {contact.site && <div className="card__site">
                                <CardLink href={contact.site} itemProp="url">{contact.site}</CardLink>
                            </div>}

                            {(contact.email || contact.site) && <div className="card__gap"></div>}

                            {contact.telegram && <div className="card__telegram">telegram: <CardLink href={`https://t.me/${contact.telegram}`}><span
                                itemProp="nickname">{contact.telegram}</span></CardLink></div>}

                            {contact.github && <div className="card__github">
                                <CardLink href={`https://github.com/${contact.github}`}>github.com/{contact.github}</CardLink>
                            </div>}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

class Card extends React.Component {
    render() {
        // TODO: change data format
        const data = {
            card: {
                titles: {},
                favicons: {}
            }
        };

        this.props.cards.forEach(card => {
            data.card.titles[card.lang] = card.name;
            data.card.favicons[card.lang] = card.favicon;
        });

        return (
            <div
                className="card"
                data-bem={JSON.stringify(data)}
                >
                { this.props.cards.map((card, i) => <CardSide key={card.lang} {...card} index={i}/>) }
                { this.props.cards.length > 1 && <CardSwitch langs={this.props.cards.map(c => c.lang)}/> }
            </div>
        )
    }
}

function AppLegacy(data) {
    return (
        <div
            className="card i-bem card_animation card_visible"
            data-bem='{"card":{"titles":{"ru":"Роман Рождественский","en":"Roman Rozhdestvenskiy"},"favicons":{"ru":"https://yastatic.net/s3/home-static/_/f0/f0597b6727cc67dceebc4e3a87caf571.png","en":"https://yastatic.net/s3/home-static/_/7c/7ccfee6f1e81b14c5bef535d1ad7b7e0.png"}}}'
        >
            <div
                className="card__side card__side_lang_ru card__side_state_opened card__layout"
                data-lang="ru"
                itemScope=""
                itemType="http://data-vocabulary.org/Person"
            >
                <div className="card__content card__rectangle">
                    <div className="card__logo"></div>
                    <div className="card__text">
                        <div className="card__title">
                            <h1 className="card__name" itemProp="name">
                                Роман Рождественский
                            </h1>
                            <div className="card__position" itemProp="title">
                                Руководитель отдела поисковых интерфейсов
                            </div>
                        </div>
                        <div
                            className="card__address"
                            itemProp="address"
                            itemScope=""
                            itemType="http://data-vocabulary.org/Address"
                        >
                            <span className="card__city" itemProp="locality">
                                Москва
                            </span>
                            ,{" "}
                            <span className="card__zip" itemProp="postal-code">
                                119021
                            </span>
                            ,{" "}
                            <span
                                className="card__country"
                                itemProp="country-name"
                            >
                                Россия
                            </span>
                            ,{" "}
                            <span
                                className="card__street-address"
                                itemProp="street-address"
                            >
                                ул. Льва Толстого, д. 16
                            </span>
                        </div>
                        <div className="card__contact">
                            <div className="card__tel card__tel_type_work">
                                тел.:{" "}
                                <a className="card__phone-link">
                                    +7 (495) 739-70-00
                                </a>
                                , доб. 6598
                            </div>
                            <div className="card__gap"></div>
                            <div className="card__email">
                                <a
                                    className="card__link"
                                    href="mailto:sbmaxx@yandex-team.ru"
                                >
                                    sbmaxx@yandex-team.ru
                                </a>
                            </div>
                            <div className="card__site">
                                <a
                                    className="card__link"
                                    href="https://rozhdestvenskiy.ru"
                                    itemProp="url"
                                >
                                    rozhdestvenskiy.ru
                                </a>
                            </div>
                            <div className="card__gap"></div>
                            <div className="card__telegram">
                                telegram:{" "}
                                <a
                                    className="card__link"
                                    href="https://t.me/sbmaxx"
                                >
                                    <span itemProp="nickname">sbmaxx</span>
                                </a>
                            </div>
                            <div className="card__github">
                                <a
                                    className="card__link"
                                    href="https://github.com/sbmaxx"
                                >
                                    github.com/sbmaxx
                                </a>
                            </div>
                        </div>
                        <div className="card__extra"></div>
                    </div>
                </div>
            </div>
            <div
                className="card__side card__side_lang_en card__side_state_closed card__layout"
                data-lang="en"
                itemScope=""
                itemType="http://data-vocabulary.org/Person"
            >
                <div className="card__content card__rectangle">
                    <div className="card__logo"></div>
                    <div className="card__text">
                        <div className="card__title">
                            <h1 className="card__name" itemProp="name">
                                Roman Rozhdestvenskiy
                            </h1>
                            <div className="card__position" itemProp="title">
                                Head of search interfaces department
                            </div>
                        </div>
                        <div
                            className="card__address"
                            itemProp="address"
                            itemScope=""
                            itemType="http://data-vocabulary.org/Address"
                        >
                            <span className="card__city" itemProp="locality">
                                Moscow
                            </span>
                            ,{" "}
                            <span className="card__zip" itemProp="postal-code">
                                119021
                            </span>
                            ,{" "}
                            <span
                                className="card__country"
                                itemProp="country-name"
                            >
                                Russia
                            </span>
                            ,{" "}
                            <span
                                className="card__street-address"
                                itemProp="street-address"
                            >
                                16, Leo Tolstoy St.
                            </span>
                        </div>
                        <div className="card__contact">
                            <div className="card__tel card__tel_type_work">
                                tel.{" "}
                                <a className="card__phone-link">
                                    +7 (495) 739-70-00
                                </a>{" "}
                                ext. 6598
                            </div>
                            <div className="card__gap"></div>
                            <div className="card__email">
                                <a
                                    className="card__link"
                                    href="mailto:sbmaxx@yandex-team.ru"
                                >
                                    sbmaxx@yandex-team.ru
                                </a>
                            </div>
                            <div className="card__site">
                                <a
                                    className="card__link"
                                    href="https://rozhdestvenskiy.ru/#en"
                                    itemProp="url"
                                >
                                    rozhdestvenskiy.ru/#en
                                </a>
                            </div>
                            <div className="card__gap"></div>
                            <div className="card__telegram">
                                telegram:{" "}
                                <a
                                    className="card__link"
                                    href="https://t.me/sbmaxx"
                                >
                                    <span itemProp="nickname">sbmaxx</span>
                                </a>
                            </div>
                            <div className="card__github">
                                <a
                                    className="card__link"
                                    href="https://github.com/sbmaxx"
                                >
                                    github.com/sbmaxx
                                </a>
                            </div>
                        </div>
                        <div className="card__extra"></div>
                    </div>
                </div>
            </div>
            <div className="card__switch">
                <a
                    className="card__link card__link_disabled_yes"
                    href="#ru"
                    data-lang="ru"
                >
                    ru
                </a>
                <a className="card__link" href="#en" data-lang="en">
                    en
                </a>
            </div>
        </div>
    );
}

export default Card;
