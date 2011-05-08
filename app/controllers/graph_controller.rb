class GraphController < ApplicationController

  def generate

    @p = params[:p] || 0.30
    @count = params[:count] || 16

    @result = { "nodes" => {}, "edges" => {}, "_" => "random graph"}

    # allocate 3 bins
    @bins = [{},{},{}]

    (0..@count-1).each do |i|
      @result["nodes"][i] = {}
      idx = rand(3)
      @bins[idx][i] = {}
    end

    @bins.each do |bin|
      bin.keys.each do |n|
        @result["nodes"].keys.each do |j|
          next if rand() > @p
          next if bin.has_key?(j)
          bin[n][j] = {}
        end
      end
    end

    @bins.each do |bin|
      @result["edges"].merge!(bin)
    end

    @result["edges"].keys do |n|
      @result["edges"][n].keys do |m|
        @result["edges"][m][n] = {}
      end
    end

    respond_to do |format|
      format.json { render :json => @result }
    end
  end
end
