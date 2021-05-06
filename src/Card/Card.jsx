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
    return <a href={href} itemProp={itemProp} target="_blank" rel="noopener noreferrer" className="card__link">{children}</a>;
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
    );
}

function rawNumber(strNumber) {
    return strNumber.replace(/\(|\)|\s|-/g, '');
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
                    <a className="card__logo" target="_blank" rel="noopener noreferrer" href={company.site}><span itemProp="affiliation">{company.name}</span></a>
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
        );
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
            <>
            <div
                className="card"
                data-bem={JSON.stringify(data)}
                >
                { this.props.cards.map((card, i) => <CardSide key={card.lang} {...card} index={i}/>) }
            </div>
            { this.props.cards.length > 1 && <CardSwitch langs={this.props.cards.map(c => c.lang)}/> }
            </>
        );
    }
}

export default Card;
