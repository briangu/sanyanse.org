class GraphController < ApplicationController

  def star
    @x = params[:p] || 0.30
    @p = @x.to_f
    @x = params[:count] || 16
    @count = @x.to_i

    @result = { "nodes" => {}, "edges" => {}, "_" => "random graph"}

    @result["nodes"][0] = { "color" => 1, "mass" => 10000, "x" => 0, "y" => 0 }
    @result["edges"][0] = {}

    (1..@count).each do |i|
      @result["nodes"][i] = { "color" => 0 }
      @result["edges"][0][i] = {}
      @result["edges"][i] = {}
      @result["edges"][i][0] = { "length" => 0.1 }
    end

    respond_to do |format|
      format.all { render :json => @result }
    end
  end

  def generate

    @x = params[:p] || 0.30
    @p = @x.to_f
    @x = params[:count] || 16
    @count = @x.to_i

    @result = { "nodes" => {}, "edges" => {}, "_" => "random graph"}

    # allocate 3 bins
    @bins = [{},{},{}]

    (0..@count-1).each do |i|
      idx = rand(3)
      @result["nodes"][i] = { "color" => idx + 1} 
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
      format.all { render :json => @result }
    end
  end
end
