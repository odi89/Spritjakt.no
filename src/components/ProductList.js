import React from 'react';
import { CSSTransition } from 'react-transition-group';
import ProductComp from './ProductComp';
import ProductType from './ProductType';
import Pagination from './Pagination';
import './css/productList.css';
import SpritjaktClient from "../datahandlers/spritjaktClient";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SortArray from 'sort-array';
import PriceGraph from "./PriceGraph";
import * as Scroll from 'react-scroll';
import {isMobile} from 'react-device-detect';
import firebase from 'firebase/app';
import 'firebase/analytics';


class ProductList extends React.Component {
    constructor(){
        super();
        this.state = {
          loadedProducts : [],
          loading: true, 
          lastWriteTime : undefined,
          sort: "LastUpdated_desc",
          productTypes: {},
          showAllresults: true,
          highlightedProduct: false,
          graphIsVisible: false,
          timeSpan: "7days" ,
          productResultCount: 0,
          page: 1,
          pageSize: 24,
          filterVisibility: false
        };
        this.productButtonRef = React.createRef();
        this.productList = React.createRef();

    }

    async componentDidMount(){
      this.updateProductResults(this.state.timeSpan);
    }

    async updateProductResults(timeSpan){
      let {lastWriteTime, products} = await SpritjaktClient.FetchProducts(timeSpan);

      this.setState({
        loading: false, 
        lastWriteTime : lastWriteTime,
        page: 1,
      });
      
      let loadedProducts = [];

      let productTypes = this.state.productTypes;
      Object.keys(productTypes).map(ptkey => (productTypes[ptkey].count = 0));

      //Updating existing product type counts
      Object.keys(products).forEach(id => {
          let p = products[id];
          loadedProducts.push(p);
          if(productTypes[p.SubType] === undefined){
            productTypes[p.SubType] = {state: false, count: 1 };
          }else{
            productTypes[p.SubType].count++;
          }
        });
      //Removing product types that are no longer present
      let filteredResultCount = 0;
      Object.keys(productTypes).forEach(ptkey => {
      
        if(productTypes[ptkey].count === 0){
           delete productTypes[ptkey]
        }
        else if(productTypes[ptkey].state){
          filteredResultCount += productTypes[ptkey].count;
        }
      });
      let selectedTypes = Object.keys(productTypes).filter( pt => {return productTypes[pt].state});
      let showAllresults = selectedTypes.length > 0 ? false : true; 
      this.setState({
        loadedProducts: loadedProducts,
        productTypes: productTypes,
        productResultCount: showAllresults ? loadedProducts.length : filteredResultCount,
        showAllresults: selectedTypes.length > 0 ? false : true
      });
      this.handleSortChange();

    }

    hideGraph = () =>{
      this.setState({ graphIsVisible: false});
    }
    setGraph = (productId, productButton) =>{


      if(productId === null || productId === this.state.highlightedProduct.Id){
        this.setState({highlightedProduct: false, graphIsVisible: false});
        this.productButtonRef.current.focus();
      }else{
        this.productButtonRef = productButton;
        let product = this.state.loadedProducts.find(p => p.Id === productId);
        this.setState({highlightedProduct: product, graphIsVisible: true});
        firebase.analytics().logEvent('select_item', {
          items: [product],
          item_list_name: 'Main Products list',
          item_list_id: 1
        });
      }
    }

    selectAllTypes = () => {
      let productTypes = this.state.productTypes;
      Object.keys(this.state.productTypes).map( pt => (productTypes[pt].state = false));
      this.setState({
        productTypes: productTypes,
        showAllresults: true,
        productResultCount: this.state.loadedProducts.length
      });      
    }

    handleFilterUpdate = (isSelected, name) => {
      let productTypes = this.state.productTypes;
      productTypes[name].state = isSelected;
      let showAllresults = true;
      let productResultCount = 0;

      firebase.analytics().logEvent('filter_click', {
        value: productTypes[name]
      });

      let selectedTypes = Object.keys(productTypes).filter( pt => (productTypes[pt].state));
      
      if(selectedTypes.length > 0){
        selectedTypes.map( pt => (productResultCount += productTypes[pt].count));
        showAllresults = false;
      }else{
       productResultCount = this.state.loadedProducts.length;
      }

      this.setState({
        productTypes: productTypes,
        showAllresults: showAllresults,
        productResultCount: productResultCount,
        page: 1
      });
    }

    displayProducts = () => {
      let list = [];
      let startPoint = this.state.pageSize * (this.state.page - 1);
      let displayedProducts = 0;
      for (let i = startPoint; i < this.state.loadedProducts.length; i++) {
        const p = this.state.loadedProducts[i];
        if( (displayedProducts < this.state.pageSize ) && (this.state.showAllresults || this.state.productTypes[p.SubType].state) ){
          displayedProducts++;
          list.push(<ProductComp key={p.Id} showDiff={true} product={p} setGraph={this.setGraph.bind(this)} />);
        }
      }
      return list;
    }

    displayProductTypes = () => {
      let list = [];
      Object.keys(this.state.productTypes).map( ptKey => ( 
        list.push(<ProductType key={ptKey} handleFilterUpdate={this.handleFilterUpdate.bind(this)} name={ptKey} productType={this.state.productTypes[ptKey]} />)        
      ));
      return list;
    }

    formatDate = (date) => {
      date.setHours(date.getHours()+2);
      return date.toISOString().slice(0,10);
    }

    handleSortChange = (event = undefined) => {
      let sorting = this.state.sort.split("_"); 
      if(event !== undefined){
        sorting = event.target.value.split("_");
        firebase.analytics().logEvent('product_sort', {
          value: event.target.value
        });
      }
      this.setState({sort: sorting[0]+"_"+sorting[1]});
      let list = this.state.loadedProducts; 
      SortArray(list, {
        by: [sorting[0], "Name"],
        order: [sorting[1], "asc"]
      });
      this.setState({loadedProducts: list});
    }

    changeTimeSpan = (event) => {
      this.setState({
        timeSpan: event.target.value,
        loading: true
      });

      firebase.analytics().logEvent('timespan_change', {
        value: event.target.value
      });
      
      this.updateProductResults(event.target.value);
    }
    
    setPage = (page) => {
      this.setState({page: page});
      Scroll.animateScroll.scrollTo(this.productList.current.offsetTop-300)  
    }
   render(){
     let {pageSize, page, productResultCount} = this.state;    
    return (
      <div key="Productlist" data-nosnippet="true"  className="main">
        <p>Nylig oppdatert</p>
        <div className="before_products">
          <div className="nav">
            <div className={"filter " + (this.state.filterVisibility ? "active" : "inactive")}>
            <button className="toggleFilter"  onClick={() => {
              this.setState({filterVisibility: !this.state.filterVisibility});
              firebase.analytics().logEvent('filter_toggle_handheld');
            }}>
              {!this.state.filterVisibility ? "Filter": <FontAwesomeIcon title="Lukk filter" icon={faTimes} /> }  
              </button>
            <fieldset  disabled={!this.state.filterVisibility && isMobile} >
              <legend>Filter</legend>
              <button disabled={this.state.showAllresults}   
               className={"clickable resetFilter show " + (this.state.showAllresults ? "inactive" : "active")}  onClick={() => this.selectAllTypes()}>
                Nullstill  
              </button>
              <div className="ProductTypes">
                {this.displayProductTypes()}
              </div>
            </fieldset>
          </div>
          <div className="sorting">
            <label htmlFor="sorting">Sortering</label><br />
            <select id="sorting" value={this.state.sort} onChange={this.handleSortChange}>
              <option value='LastUpdated_desc' >Nyeste</option>
              <option value='SortingDiscount_asc' >Prisendring</option>
              <option value='Name_asc' >Navn (A-Å)</option>
              <option value='Name_desc' >Navn (Å-A)</option>
              <option value='LatestPrice_asc' >Pris (lav-høy)</option>
              <option value='LatestPrice_desc' >Pris (høy-lav)</option>
          </select>
          </div>
          <div className="timeSpan">
            <label htmlFor="timespan">Tidsperiode</label><br />
            <select id="timespan" value={this.state.timeSpan} onChange={this.changeTimeSpan}>
                <option value='7days' >Siste 7 dager</option>
                <option value='14days' >Siste 14 dager</option>
                <option value='30days' >Siste 30 dager</option>
                <option value='90days' >Siste 90  dager</option>
            </select>
          </div>
        </div>
         </div>
        <Pagination total={this.state.productResultCount} page={this.state.page} setPage={this.setPage.bind(this)}  pageSize={pageSize} />
      <ul ref={this.productList}  className="ProductList">
      {this.state.loading ? <FontAwesomeIcon icon={faCircleNotch}  size="5x" /> 
      : this.displayProducts() }
      </ul>
      {this.state.productResultCount === 0 && this.state.loading === false ? <p style={{"textAlign" :" center", "fontWeight": "bold"}}>Her var det ikke noe, gitt :/</p> : "" }
      <Pagination total={productResultCount} page={page} setPage={this.setPage.bind(this)}  pageSize={pageSize} />
      <CSSTransition 
        in={this.state.graphIsVisible} 
        timeout={100} 
        className="toggle"
        onExited={() => this.setGraph(null, null)}
         >
        <div>
          {this.state.highlightedProduct &&
          <div className="priceGraphWrapper">
            <PriceGraph p={this.state.highlightedProduct} />
            <div className="backdrop"  onClick={() => this.hideGraph()} >
                <label htmlFor="closeGraph">Tilbake</label>
                <button name="closeGraph" className="close"> <FontAwesomeIcon icon={faTimes} /></button>
            </div>
          </div>
            }
        </div>
      </CSSTransition>
      <div className={"filter_backdrop " + (this.state.filterVisibility ? "active" : "inactive")} onClick={() => this.setState({filterVisibility: false})}></div>
      </div>
    );
  }
}

export default ProductList;
