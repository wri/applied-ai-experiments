# {Experiment Title}

Displays WRI assets (currently datasets) visually in a 2d projection for a user to search and explore. 

## Before

### What problem or question does this address?

Finding datasets, publications, and other WRI assets related to a given
topic can be frustratingly difficult. This experiment allows provides a
semantic search for such assets across a range of WRI platforms, and can
help identify "similar" assets. 

### What does this experiment actually do?

This experiment, the WRI Asset Locator, takes the following approach. 

Information about data assets are fetched from WRI platforms, including: 
* Resource Watch
* WRI's ArcGIS catalog
* Global Forest Watch
* Energy Access Explorer
* WRI Data Explorer

Metadata about each asset is converted to a high dimensional vector
representation. The challenge here is that this information is not
consistent and many fields may be missing. 

Having produced such a vector for each asset, the tool can judge assets to
be similar based on their proximity in this high-dimensional space. 

To produce a visualization, these Asset vectors are projected down to two
dimensions using the UMAP method, which attempts to preserve these
similarities. 

A notebook interface allows a user to view and navigate the Assets in this 
visualization and make selections.  The user can also enter a search term,
and relevant Assets will be highlighted visually. 

### What signals are we looking for?

We have heard anecdotally that it can be difficult to know what assets
exist and how to find them at WRI. There are many ways to alleviate this
problem, and this tool represents only one such approach. 

If you are able to use this tool to find assets that you didn't know about,
or after playing with it you really wish it had more assets in it, or a
specific type of asset that your team needs to locate, we want to hear from
you. 

If you find this concept interesting in any way, we want to hear from you. 

If this approach gives you an idea for a completely different way to locate
assets at WRI, we want to hear about that idea! 

### What are the known limitations? 

This experiment only has assets from a small number of sources at WRI. We also
understand that some of these sources may be noisier or outdated. 

The methodology was selected intentionally such that it would work with any
type of asset. However currently the tool is only ingesting WRI datasets --
it is not attempting to work with WRI knowledge products, WRI blog posts,
or other types of WRI assets.

There are a number of improvements we could make to improve the embedding
(vectorization) and search features, esecially by cleaning and filtering
the data we have about each Asset. 

The current user interface is essentially a interactive altair chart in the 
notebook. In a proper implementation of this tool, this visualization would 
be greatly improved for usability and design. 
