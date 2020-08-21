import React from 'react';
import './css/pagination.css';
import PageButton from './PageButton';

class Pagination extends React.Component {
    constructor(props) {
        super(props);
    }
    setPage = (page) => {
        this
            .props
            .setPage(page);
    }

    renderPageButtons = () => {
        let list = [];
        for (let i = 1; i <= Math.ceil(this.props.total / this.props.pageSize); i++) {
            list.push(<PageButton
                key={"page-" + i}
                page={i}
                isSelected={this.props.page == i}
                setPage={this
                .setPage
                .bind(this)}/>);
        }
        return list;
    }
    render() {
        let {pageSize, page, total} = this.props;
        let productsShowingtext = "";
        if (page === 1) {
            productsShowingtext += "1 - " + (pageSize > total
                ? total
                : pageSize);
        } else {
            productsShowingtext += (pageSize + 1 * (page - 1)) + " - " + (pageSize * page > total
                ? total
                : pageSize * page);

        }
        return (
            <nav className="Pagination">
                <ul className="pagelist">
                    {this.renderPageButtons()}
                </ul>
                <span>Viser {productsShowingtext}
                    av {total}
                    produkter</span>
            </nav>
        );
    }
}

export default Pagination;
